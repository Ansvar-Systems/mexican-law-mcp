/**
 * Rate-limited HTTP client for Cámara de Diputados (diputados.gob.mx)
 *
 * The Cámara de Diputados (Chamber of Deputies) of the Mexican Congress
 * maintains the official compilation of all federal legislation at:
 *   https://www.diputados.gob.mx/LeyesBiblio/
 *
 * Laws are available as:
 *   - PDF:  /LeyesBiblio/pdf/{CODE}.pdf
 *   - HTML: /LeyesBiblio/ref/{code}.htm (index with reform history)
 *   - HTM:  /LeyesBiblio/pdf_mov/{Full_Name}.pdf (mobile-friendly consolidated text)
 *
 * Key considerations:
 *   - 300ms minimum delay between requests (respectful to government servers)
 *   - Max 5 concurrent requests
 *   - User-Agent header identifying the MCP
 *   - Retry on 429/5xx with exponential backoff
 *   - No auth needed (public government data)
 *   - diputados.gob.mx often serves HTML in windows-1252/ISO-8859-1 encoding
 *   - Connection timeout of 15s (site can be slow or unreachable)
 */

const USER_AGENT = 'Mexican-Law-MCP/1.0 (https://github.com/Ansvar-Systems/mexican-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 300;
const CONNECT_TIMEOUT_MS = 15_000;

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
 *
 * Strategy: Try multiple URL patterns in order of preference:
 *   1. /LeyesBiblio/ref/{code}.htm (reform history page with full text)
 *   2. /LeyesBiblio/pdf/{CODE}.pdf (PDF fallback — not parseable as HTML)
 *
 * Returns the first successful result.
 */
export async function fetchLawHtml(code: string): Promise<FetchResult> {
  // Primary: the ref page with consolidated text
  const refUrl = `https://www.diputados.gob.mx/LeyesBiblio/ref/${code}.htm`;
  const result = await fetchWithRateLimit(refUrl);

  // If ref page works and has content, use it
  if (result.status === 200 && result.body.length > 500) {
    return result;
  }

  // Try alternate URL pattern (some laws use different ref path)
  const altUrl = `https://www.diputados.gob.mx/LeyesBiblio/ref/${code}_ref.htm`;
  const altResult = await fetchWithRateLimit(altUrl);

  if (altResult.status === 200 && altResult.body.length > 500) {
    return altResult;
  }

  // Return the original result (even if failed) for error handling upstream
  return result;
}
