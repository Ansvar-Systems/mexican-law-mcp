/**
 * Rate-limited HTTP client for Cámara de Diputados (diputados.gob.mx)
 *
 * The Cámara de Diputados (Chamber of Deputies) of the Mexican Congress
 * maintains the official compilation of all federal legislation at:
 *   https://www.diputados.gob.mx/LeyesBiblio/
 *
 * Laws are available as:
 *   - PDF:  /LeyesBiblio/pdf/{CODE}.pdf (consolidated law text — primary source)
 *   - HTML: /LeyesBiblio/ref/{code}.htm (reform history index, NOT law text)
 *
 * IMPORTANT: The ref/*.htm pages contain reform/amendment history, not the actual
 * consolidated law text. The PDF files are the authoritative source for current
 * law text. Text is extracted from PDFs using pdftotext (poppler-utils).
 *
 * Key considerations:
 *   - 300ms minimum delay between requests (respectful to government servers)
 *   - Max 5 concurrent requests
 *   - User-Agent header identifying the MCP
 *   - Retry on 429/5xx with exponential backoff
 *   - No auth needed (public government data)
 *   - Connection timeout of 30s (PDFs can be large, site can be slow)
 *   - PDF extraction may introduce OCR-like artifacts (spacing, encoding)
 */

const USER_AGENT = 'Mexican-Law-MCP/1.0 (https://github.com/Ansvar-Systems/mexican-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 300;
const CONNECT_TIMEOUT_MS = 30_000;

let lastRequestTime = 0;
let activeRequests = 0;
const MAX_CONCURRENT = 5;

async function rateLimit(): Promise<void> {
  // Wait for concurrency slot
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  activeRequests++;
}

function releaseSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1);
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

/**
 * Decode a response body handling ISO-8859-1 / windows-1252 encoding
 * which is common on diputados.gob.mx.
 */
async function decodeResponseBody(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  // Check if charset is specified
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  const charset = charsetMatch?.[1]?.toLowerCase() ?? '';

  if (charset === 'iso-8859-1' || charset === 'windows-1252' || charset === 'latin1') {
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(buffer);
  }

  // Try to detect encoding from HTML meta tags
  // First get as arrayBuffer to handle any encoding
  const buffer = await response.arrayBuffer();

  // Peek at the first 2KB to check for meta charset
  const peek = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, 2048));
  const metaCharset = peek.match(/charset=["']?(iso-8859-1|windows-1252|latin1)/i);

  if (metaCharset) {
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(buffer);
  }

  // Default to UTF-8
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(buffer);
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html, application/xhtml+xml, */*',
            'Accept-Language': 'es-MX,es;q=0.9,en;q=0.5',
          },
          redirect: 'follow',
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxRetries) {
            const backoff = Math.pow(2, attempt + 1) * 1000;
            console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            continue;
          }
        }

        const body = await decodeResponseBody(response);
        return {
          status: response.status,
          body,
          contentType: response.headers.get('content-type') ?? '',
          url: response.url,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxRetries) {
            console.log(`  Timeout for ${url}, retrying...`);
            continue;
          }
          return { status: 0, body: '', contentType: '', url };
        }
        throw error;
      }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
  } finally {
    releaseSlot();
  }
}

/**
 * Fetch the HTML reference page for a specific Mexican federal law.
 * NOTE: ref/*.htm pages contain reform history, NOT the consolidated law text.
 * Use fetchLawPdf() for the actual law content.
 */
export async function fetchLawHtml(code: string): Promise<FetchResult> {
  const refUrl = `https://www.diputados.gob.mx/LeyesBiblio/ref/${code}.htm`;
  const result = await fetchWithRateLimit(refUrl);

  if (result.status === 200 && result.body.length > 500) {
    return result;
  }

  const altUrl = `https://www.diputados.gob.mx/LeyesBiblio/ref/${code}_ref.htm`;
  const altResult = await fetchWithRateLimit(altUrl);

  if (altResult.status === 200 && altResult.body.length > 500) {
    return altResult;
  }

  return result;
}

/**
 * Known PDF filename overrides where the filename doesn't match
 * the simple uppercase convention. diputados.gob.mx uses mixed case
 * for some PDF filenames (e.g., "CCom.pdf" instead of "CCOM.pdf").
 */
const PDF_CODE_OVERRIDES: Record<string, string> = {
  ccom: 'CCom',
  cnpp: 'CNPP',
};

/**
 * Download the PDF of a Mexican federal law.
 *
 * The PDF at /LeyesBiblio/pdf/{CODE}.pdf contains the consolidated (current)
 * law text. This is the primary source — the ref/*.htm pages only contain
 * reform history.
 *
 * Tries multiple URL patterns because diputados.gob.mx uses inconsistent
 * filename casing (some PDFs use UPPERCASE, others use MixedCase).
 *
 * Returns the raw PDF bytes as a Buffer.
 */
export async function fetchLawPdf(code: string, pdfUrl?: string): Promise<{ status: number; buffer: Buffer; url: string }> {
  // Build candidate URLs to try
  const candidateUrls: string[] = [];

  // If census provides a direct PDF URL, try it first
  if (pdfUrl) {
    candidateUrls.push(pdfUrl);
  }

  // Build fallback candidate codes
  const candidates: string[] = [];
  if (PDF_CODE_OVERRIDES[code]) {
    candidates.push(PDF_CODE_OVERRIDES[code]);
  }
  candidates.push(code.toUpperCase()); // CCOM
  // Title case: capitalize first letter of each word-like segment
  const titleCase = code.replace(/(?:^|_)(\w)/g, (_, c) => c.toUpperCase());
  if (!candidates.includes(titleCase)) candidates.push(titleCase);
  if (!candidates.includes(code)) candidates.push(code); // lowercase

  for (const c of candidates) {
    const url = `https://www.diputados.gob.mx/LeyesBiblio/pdf/${c}.pdf`;
    if (!candidateUrls.includes(url)) candidateUrls.push(url);
  }

  await rateLimit();

  try {
    // Try each candidate URL
    for (const url of candidateUrls) {

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

          const response = await fetch(url, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/pdf, */*',
            },
            redirect: 'follow',
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.status === 429 || response.status >= 500) {
            if (attempt < 2) {
              const backoff = Math.pow(2, attempt + 1) * 1000;
              await new Promise(resolve => setTimeout(resolve, backoff));
              continue;
            }
          }

          // If 404, try next candidate code
          if (response.status === 404) break;

          if (response.status !== 200) {
            return { status: response.status, buffer: Buffer.alloc(0), url };
          }

          const arrayBuffer = await response.arrayBuffer();
          return { status: response.status, buffer: Buffer.from(arrayBuffer), url };
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            if (attempt < 2) continue;
            break; // try next candidate
          }
          throw error;
        }
      }
    }

    // All candidates failed
    return { status: 404, buffer: Buffer.alloc(0), url: candidateUrls[0] };
  } finally {
    releaseSlot();
  }
}

/**
 * Convert a PDF buffer to plain text using pdftotext (poppler-utils).
 *
 * ACCURACY WARNING: PDF text extraction is not perfectly accurate.
 * PDF is a presentation format, not a semantic format. Common issues:
 *   - Column layouts may merge or interleave text
 *   - Headers/footers may appear mid-text
 *   - Special characters (accents, ñ) may be lost or garbled
 *   - Hyphenated line breaks may not rejoin correctly
 *   - Table content may lose structure
 *
 * For the authoritative text, always refer to the official PDF at
 * diputados.gob.mx/LeyesBiblio/pdf/{CODE}.pdf
 */
export async function pdfToText(pdfBuffer: Buffer, pdfPath: string): Promise<string> {
  const { execSync } = await import('child_process');
  const fs = await import('fs');

  // Write PDF to temp file
  fs.writeFileSync(pdfPath, pdfBuffer);

  try {
    // pdftotext with -layout preserves spatial layout (better for article structure)
    const text = execSync(`pdftotext -layout -enc UTF-8 "${pdfPath}" -`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 60_000,
    }).toString('utf-8');

    return text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`pdftotext failed for ${pdfPath}: ${msg}`);
  }
}
