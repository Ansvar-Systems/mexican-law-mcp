/**
 * Rate-limited HTTP client for Cámara de Diputados (diputados.gob.mx)
 *
 * The Cámara de Diputados (Chamber of Deputies) of the Mexican Congress
 * maintains the official compilation of all federal legislation at:
 *   https://www.diputados.gob.mx/LeyesBiblio/
 *
 * Laws are available as:
 *   - DOC:  /LeyesBiblio/doc/{CODE}.doc (Word binary format — preferred source)
 *   - PDF:  /LeyesBiblio/pdf/{CODE}.pdf (consolidated law text — fallback)
 *   - HTML: /LeyesBiblio/ref/{code}.htm (reform history index, NOT law text)
 *
 * IMPORTANT: The ref/*.htm pages contain reform/amendment history, not the actual
 * consolidated law text. DOC files are preferred over PDF because they produce
 * cleaner text without page headers, footers, and page numbers. Text is extracted
 * from DOC files using antiword. PDF fallback uses pdftotext (poppler-utils).
 *
 * Key considerations:
 *   - 300ms minimum delay between requests (respectful to government servers)
 *   - Max 5 concurrent requests
 *   - User-Agent header identifying the MCP
 *   - Retry on 429/5xx with exponential backoff
 *   - No auth needed (public government data)
 *   - Connection timeout of 30s (files can be large, site can be slow)
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
 * Download a law file (.doc or .pdf) from diputados.gob.mx.
 *
 * Tries DOC format first (cleaner text extraction), then falls back to PDF.
 * The code parameter should match the exact code from the index page
 * (case-sensitive, e.g., "LAmp", "CPEUM", "LFPDPPP").
 *
 * Returns the raw file bytes as a Buffer and the format used.
 */
export async function fetchLawFile(code: string, docUrl?: string, pdfUrl?: string): Promise<{ status: number; buffer: Buffer; url: string; format: 'doc' | 'pdf' }> {
  // Build candidate URLs: DOC first, then PDF
  const candidates: Array<{ url: string; format: 'doc' | 'pdf' }> = [];

  // DOC URLs
  if (docUrl) {
    candidates.push({ url: docUrl, format: 'doc' });
  }
  candidates.push({ url: `https://www.diputados.gob.mx/LeyesBiblio/doc/${code}.doc`, format: 'doc' });

  // PDF fallback
  if (pdfUrl) {
    candidates.push({ url: pdfUrl, format: 'pdf' });
  }
  candidates.push({ url: `https://www.diputados.gob.mx/LeyesBiblio/pdf/${code}.pdf`, format: 'pdf' });

  await rateLimit();

  try {
    for (const candidate of candidates) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

          const response = await fetch(candidate.url, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': '*/*',
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

          if (response.status === 404) break; // try next candidate

          if (response.status !== 200) {
            return { status: response.status, buffer: Buffer.alloc(0), url: candidate.url, format: candidate.format };
          }

          const arrayBuffer = await response.arrayBuffer();
          return { status: response.status, buffer: Buffer.from(arrayBuffer), url: candidate.url, format: candidate.format };
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            if (attempt < 2) continue;
            break;
          }
          throw error;
        }
      }
    }

    return { status: 404, buffer: Buffer.alloc(0), url: candidates[0].url, format: 'doc' };
  } finally {
    releaseSlot();
  }
}

/**
 * Legacy wrapper — downloads PDF only. Used by older code paths.
 */
export async function fetchLawPdf(code: string, pdfUrl?: string): Promise<{ status: number; buffer: Buffer; url: string }> {
  const result = await fetchLawFile(code, undefined, pdfUrl);
  return { status: result.status, buffer: result.buffer, url: result.url };
}

/**
 * Convert a DOC file to plain text using antiword.
 *
 * antiword extracts text from Microsoft Word binary (.doc) files.
 * The -m UTF-8.txt flag produces UTF-8 output. This gives cleaner text
 * than PDF extraction — no page headers, footers, or page numbers.
 *
 * Reform annotations (e.g., "Párrafo reformado DOF 10-06-2011") are
 * present in the source document itself and will appear in the output.
 */
export async function docToText(docBuffer: Buffer, docPath: string): Promise<string> {
  const { execSync } = await import('child_process');
  const fs = await import('fs');

  fs.writeFileSync(docPath, docBuffer);

  try {
    const text = execSync(`antiword -m UTF-8.txt "${docPath}"`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60_000,
    }).toString('utf-8');

    return text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`antiword failed for ${docPath}: ${msg}`);
  }
}

/**
 * Convert a PDF buffer to plain text using pdftotext (poppler-utils).
 * Fallback when DOC format is unavailable.
 */
export async function pdfToText(pdfBuffer: Buffer, pdfPath: string): Promise<string> {
  const { execSync } = await import('child_process');
  const fs = await import('fs');

  fs.writeFileSync(pdfPath, pdfBuffer);

  try {
    const text = execSync(`pdftotext -layout -enc UTF-8 "${pdfPath}" -`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60_000,
    }).toString('utf-8');

    return text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`pdftotext failed for ${pdfPath}: ${msg}`);
  }
}
