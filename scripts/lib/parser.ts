/**
 * Parser for Mexican federal legislation from diputados.gob.mx
 *
 * Parses plain text (extracted from DOC via antiword, or PDF via pdftotext)
 * into structured provision data. Mexican legislation follows civil law
 * tradition with "Artículo X" numbering. Laws are organized as:
 *
 *   TÍTULO (Title) > CAPÍTULO (Chapter) > SECCIÓN (Section) > Artículo N
 *
 * Text patterns:
 *   - Articles:   "Artículo N.-" or "Artículo N." at line start
 *   - Chapters:   "CAPÍTULO I" or "Capítulo I"
 *   - Titles:     "TÍTULO PRIMERO" or "Título Primero"
 *   - Transitory: "TRANSITORIOS" or "ARTÍCULOS TRANSITORIOS"
 *   - Fractions:  I., II., III., etc. (Roman numeral sub-provisions)
 *
 * DOC extraction (via antiword) produces cleaner text than PDF — no page
 * headers, footers, or page numbers. Reform annotations are present in
 * both formats as they are part of the source document.
 */

export interface LawIndexEntry {
  id: string;
  code: string;
  title: string;
  titleEn?: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  pdfUrl?: string;
  docUrl?: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedLaw {
  id: string;
  type: 'statute';
  title: string;
  title_en?: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip HTML tags and decode common entities to plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x00A0;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, '\u00E1')
    .replace(/&eacute;/g, '\u00E9')
    .replace(/&iacute;/g, '\u00ED')
    .replace(/&oacute;/g, '\u00F3')
    .replace(/&uacute;/g, '\u00FA')
    .replace(/&ntilde;/g, '\u00F1')
    .replace(/&Aacute;/g, '\u00C1')
    .replace(/&Eacute;/g, '\u00C9')
    .replace(/&Iacute;/g, '\u00CD')
    .replace(/&Oacute;/g, '\u00D3')
    .replace(/&Uacute;/g, '\u00DA')
    .replace(/&Ntilde;/g, '\u00D1')
    .replace(/&uuml;/g, '\u00FC')
    .replace(/&Uuml;/g, '\u00DC')
    .replace(/&iexcl;/g, '\u00A1')
    .replace(/&iquest;/g, '\u00BF')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an article number for use as provision_ref.
 * "Artículo 211 Bis 1" -> "art211bis1"
 * "Artículo 16" -> "art16"
 * "Artículo 1o." -> "art1"
 * "Artículo Primero Transitorio" -> "trans1"
 */
function normalizeArticleRef(raw: string): string {
  let ref = raw.toLowerCase().trim();
  // Remove ordinal suffixes (1o., 2a., etc.)
  ref = ref.replace(/(\d+)\s*[oa]\.?/g, '$1');
  // Handle "bis", "ter", "quater" etc.
  ref = ref.replace(/\s+/g, '');
  // Prefix with "art"
  if (!ref.startsWith('art')) {
    ref = `art${ref}`;
  }
  return ref;
}

/**
 * Extract articles from the HTML text of a Mexican law.
 *
 * Strategy: Find all "Artículo N" occurrences and extract the content
 * between consecutive article headers. Track current TÍTULO/CAPÍTULO
 * context for chapter assignment.
 */
function extractArticles(html: string): { provisions: ParsedProvision[]; definitions: ParsedDefinition[] } {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Find all article positions
  // Patterns: "Artículo 1", "Artículo 211 Bis 1", "Artículo 1o.", "ARTÍCULO 1"
  const articleRe = /(?:<[^>]*>)*\s*(?:Art[ií]culo)\s+([\d]+(?:\s*(?:Bis|Ter|Qu[aá]ter|Quintus|Sextus|Septimus)\s*\d*)?(?:\s*[oa]\.?)?)\s*[\.\-]/gi;

  const articlePositions: { num: string; pos: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = articleRe.exec(html)) !== null) {
    const rawNum = m[1].trim();
    articlePositions.push({ num: rawNum, pos: m.index });
  }

  if (articlePositions.length === 0) return { provisions, definitions };

  // Track current TÍTULO and CAPÍTULO context
  const chapterRe = /(?:<[^>]*>)*\s*(?:T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+([^<\n]+)/gi;
  const chapterPositions: { label: string; pos: number }[] = [];

  while ((m = chapterRe.exec(html)) !== null) {
    const label = stripHtml(m[0]).trim();
    if (label.length > 0 && label.length < 200) {
      chapterPositions.push({ label, pos: m.index });
    }
  }

  let currentChapter = '';

  for (let i = 0; i < articlePositions.length; i++) {
    const article = articlePositions[i];
    const nextArticlePos = i + 1 < articlePositions.length
      ? articlePositions[i + 1].pos
      : html.length;

    // Update chapter context
    for (const ch of chapterPositions) {
      if (ch.pos < article.pos) {
        currentChapter = ch.label;
      }
    }

    // Extract HTML block for this article
    const articleHtml = html.substring(article.pos, nextArticlePos);
    let text = stripHtml(articleHtml);

    // Cap at 8000 chars
    if (text.length > 8000) {
      text = text.substring(0, 8000);
    }

    // Skip very short or empty articles
    if (text.length < 15) continue;

    const ref = normalizeArticleRef(article.num);
    const sectionNum = article.num.replace(/\s+/g, ' ').trim();

    // Extract a title from the first line if possible
    let title = '';
    const titleMatch = text.match(/^Art[ií]culo\s+[\d\w\s.]+[\.\-]\s*([^.]+\.)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      if (title.length > 120) title = title.substring(0, 120);
    }

    provisions.push({
      provision_ref: ref,
      chapter: currentChapter || undefined,
      section: sectionNum,
      title,
      content: text,
    });

    // Extract definitions from articles that contain definition patterns
    // Mexican laws often define terms with: "se entenderá por:", "Para los efectos de esta Ley, se entiende por:"
    // followed by Roman numeral lists "I. Término: definición;"
    if (/se\s+(?:entender[áa]|entiende)\s+por|Para\s+(?:los\s+)?efectos\s+de/i.test(text)) {
      const defRe = /([IVXLC]+)\.\s*([^:]+):\s*([^;]+(?:;|$))/g;
      let dm: RegExpExecArray | null;
      while ((dm = defRe.exec(text)) !== null) {
        const term = dm[2].trim();
        const definition = dm[3].trim().replace(/;$/, '').trim();
        if (term.length > 2 && term.length < 100 && definition.length > 5) {
          definitions.push({
            term,
            definition: `${term}: ${definition}`,
            source_provision: ref,
          });
        }
      }
    }
  }

  return { provisions, definitions };
}

/**
 * Extract transitory articles (TRANSITORIOS) from the HTML.
 * Transitory articles contain implementation dates, deadlines,
 * and transitional provisions.
 */
function extractTransitoryArticles(html: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  const transitoryMatch = html.match(/(?:<[^>]*>)*\s*TRANSITORIOS?\s*(?:<[^>]*>)*([\s\S]*?)(?:<\/body>|$)/i);
  if (!transitoryMatch) return provisions;

  const transitoryHtml = transitoryMatch[0];
  const transitoryRe = /(?:(?:Art[ií]culo|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO|[ÚU]NICO)\s*(?:Transitorio)?)\s*[\.\-]/gi;

  const positions: { label: string; pos: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = transitoryRe.exec(transitoryHtml)) !== null) {
    positions.push({ label: stripHtml(m[0]).trim(), pos: m.index });
  }

  for (let i = 0; i < positions.length && i < 20; i++) {
    const pos = positions[i];
    const nextPos = i + 1 < positions.length
      ? positions[i + 1].pos
      : transitoryHtml.length;

    const text = stripHtml(transitoryHtml.substring(pos.pos, nextPos));
    if (text.length < 15) continue;

    provisions.push({
      provision_ref: `trans${i + 1}`,
      chapter: 'TRANSITORIOS',
      section: `Transitorio ${i + 1}`,
      title: pos.label,
      content: text.substring(0, 8000),
    });
  }

  return provisions;
}

/**
 * Parse a diputados.gob.mx HTML page into structured law data.
 *
 * Extracts:
 * - All numbered articles (Artículo 1, 2, ...) with their fractions
 * - TÍTULO/CAPÍTULO context as chapter labels
 * - Defined terms from definition articles
 * - Transitory articles
 */
export function parseMexicanHtml(html: string, law: LawIndexEntry): ParsedLaw {
  // Check for 404 / error page
  if (html.includes('Error 404') || html.includes('No encontrado') || html.length < 500) {
    console.log(`    WARNING: ${law.shortName} returned error or empty page`);
    return {
      id: law.id,
      type: 'statute',
      title: law.title,
      title_en: law.titleEn,
      short_name: law.shortName,
      status: law.status,
      issued_date: law.issuedDate,
      in_force_date: law.inForceDate,
      url: law.url,
      description: law.description ?? law.title,
      provisions: [],
      definitions: [],
    };
  }

  const { provisions, definitions } = extractArticles(html);
  const transitoryProvisions = extractTransitoryArticles(html);

  return {
    id: law.id,
    type: 'statute',
    title: law.title,
    title_en: law.titleEn,
    short_name: law.shortName,
    status: law.status,
    issued_date: law.issuedDate,
    in_force_date: law.inForceDate,
    url: law.url,
    description: law.description ?? law.title,
    provisions: [...provisions, ...transitoryProvisions],
    definitions,
  };
}

/**
 * Extract articles from plain text (pdftotext output).
 *
 * PDF text has each article starting with "Artículo N.-" or "Artículo N."
 * on a new line (sometimes with leading whitespace from layout preservation).
 * We split on article boundaries and collect text between them.
 */
/**
 * Clean raw pdftotext output by removing recurring page artifacts.
 *
 * diputados.gob.mx PDFs have a consistent layout:
 *   - Header: law title (all caps) repeated on every page
 *   - Sub-header: "CÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN"
 *   - Sub-header: "Secretaría General" / "Secretaría de Servicios Parlamentarios"
 *   - Footer: "Última Reforma DOF dd-mm-yyyy"
 *   - Page numbers: "N de M" centered at bottom
 *   - Reform annotations: "Párrafo reformado DOF ..." / "Artículo adicionado DOF ..."
 *
 * These are editorial/layout elements, not part of the law text.
 */
function cleanPdfText(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines (will be normalized later)
    if (trimmed.length === 0) {
      cleaned.push('');
      continue;
    }

    // Skip page headers: "CÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN"
    if (/^CÁMARA DE DIPUTADOS/i.test(trimmed)) continue;

    // Skip sub-headers
    if (/^Secretar[ií]a\s+(General|de\s+Servicios\s+Parlamentarios)/i.test(trimmed)) continue;

    // Skip "Última Reforma DOF" lines
    if (/^Última\s+Reforma\s+DOF/i.test(trimmed)) continue;

    // Skip page numbers: "N de M" (where N and M are numbers, line is just this)
    if (/^\d{1,4}\s+de\s+\d{1,4}$/.test(trimmed)) continue;

    // Skip reform annotation lines (editorial notes, not law text)
    // "Párrafo reformado DOF 10-06-2011", "Artículo adicionado DOF ...", etc.
    if (/^(?:Párrafo|Art[ií]culo|Fracción|Inciso|Numeral|Apartado|Base|Secci[oó]n)\s+(?:reformad|adicionad|derogad|abrogad|publicad)/i.test(trimmed)) continue;
    // Also match "Denominación del Capítulo reformada DOF ..."
    if (/^Denominaci[oó]n\s+(?:del|de\s+la|de\s+los)?\s*(?:Cap[ií]tulo|T[ií]tulo|Secci[oó]n)\s+(?:reformad|adicionad)/i.test(trimmed)) continue;
    // "Fe de erratas DOF ..."  / "Nota de vigencia: ..."
    if (/^(?:Fe\s+de\s+erratas|Nota\s+de\s+vigencia)\b/i.test(trimmed)) continue;
    // "(Reformado|Adicionado|Derogado), DOF ..." at line start
    if (/^\((?:Reformad|Adicionad|Derogad|Abrogad)/i.test(trimmed)) continue;

    // Skip repeated law title headers (all-caps law name repeated on every page)
    // These are typically > 30 chars, ALL CAPS, and repeat the law title
    // We detect them by checking if a line is ALL CAPS and appears many times
    // (handled more efficiently below)

    cleaned.push(line);
  }

  let result = cleaned.join('\n');

  // Remove repeated all-caps law title lines that appear on every page
  // Find the most common all-caps line (>20 chars) and remove all occurrences
  const capsLineCount: Record<string, number> = {};
  for (const line of cleaned) {
    const t = line.trim();
    if (t.length > 20 && t === t.toUpperCase() && /^[A-ZÁÉÍÓÚÑÜ\s,.\-()]+$/.test(t)) {
      capsLineCount[t] = (capsLineCount[t] || 0) + 1;
    }
  }
  for (const [capsLine, count] of Object.entries(capsLineCount)) {
    if (count >= 5) {
      // This line appears on many pages — it's a header, remove it
      result = result.split('\n').filter(l => l.trim() !== capsLine).join('\n');
    }
  }

  // Collapse excessive blank lines
  result = result.replace(/\n{4,}/g, '\n\n\n');

  return result;
}

function extractArticlesFromText(text: string): { provisions: ParsedProvision[]; definitions: ParsedDefinition[] } {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Split text into lines for processing
  const lines = text.split('\n');

  // Find article start lines and chapter/title context
  // Pattern: "Artículo N" at start of line (with optional whitespace)
  const articleStartRe = /^\s*Art[ií]culo\s+([\d]+(?:\s*(?:Bis|Ter|Qu[aá]ter|Quintus|Sextus|Septimus)\s*\d*)?(?:\s*[oa]\.?)?)\s*[\.\-]/i;
  const chapterRe = /^\s*(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+(.+)/i;
  const transitoryRe = /^\s*(TRANSITORIOS?|ART[IÍ]CULOS?\s+TRANSITORIOS?)\s*$/i;

  interface ArticleBlock {
    num: string;
    startLine: number;
    chapter: string;
  }

  const articleBlocks: ArticleBlock[] = [];
  let currentChapter = '';
  let transitoryStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for chapter/title/section headers
    const chapterMatch = line.match(chapterRe);
    if (chapterMatch) {
      currentChapter = `${chapterMatch[1].toUpperCase()} ${chapterMatch[2].trim()}`;
      // Truncate long chapter names
      if (currentChapter.length > 200) currentChapter = currentChapter.substring(0, 200);
      continue;
    }

    // Check for transitory section start
    if (transitoryRe.test(line)) {
      transitoryStart = i;
      continue;
    }

    // Check for article start (only before TRANSITORIOS)
    if (transitoryStart === -1) {
      const articleMatch = line.match(articleStartRe);
      if (articleMatch) {
        articleBlocks.push({
          num: articleMatch[1].trim(),
          startLine: i,
          chapter: currentChapter,
        });
      }
    }
  }

  // Extract article text between boundaries
  for (let i = 0; i < articleBlocks.length; i++) {
    const block = articleBlocks[i];
    const endLine = i + 1 < articleBlocks.length
      ? articleBlocks[i + 1].startLine
      : (transitoryStart !== -1 ? transitoryStart : lines.length);

    // Collect lines for this article
    let text = lines.slice(block.startLine, endLine).join('\n').trim();

    // Clean up pdftotext layout artifacts (excessive whitespace)
    text = text
      .replace(/\n\s*\n\s*\n/g, '\n\n') // collapse triple+ newlines
      .replace(/[ \t]{3,}/g, '  ')        // collapse excessive horizontal space
      .trim();

    // Cap at 8000 chars
    if (text.length > 8000) {
      text = text.substring(0, 8000);
    }

    // Skip very short articles
    if (text.length < 15) continue;

    const ref = normalizeArticleRef(block.num);
    const sectionNum = block.num.replace(/\s+/g, ' ').trim();

    // Extract a title from the first sentence
    let title = '';
    const titleMatch = text.match(/^Art[ií]culo\s+[\d\w\s.]+[\.\-]\s*([^.\n]+\.)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      if (title.length > 120) title = title.substring(0, 120);
    }

    provisions.push({
      provision_ref: ref,
      chapter: block.chapter || undefined,
      section: sectionNum,
      title,
      content: text,
    });

    // Extract definitions
    if (/se\s+(?:entender[áa]|entiende)\s+por|Para\s+(?:los\s+)?efectos\s+de/i.test(text)) {
      const defRe = /([IVXLC]+)\.\s*([^:]+):\s*([^;]+(?:;|$))/g;
      let dm: RegExpExecArray | null;
      while ((dm = defRe.exec(text)) !== null) {
        const term = dm[2].trim();
        const definition = dm[3].trim().replace(/;$/, '').trim();
        if (term.length > 2 && term.length < 100 && definition.length > 5) {
          definitions.push({
            term,
            definition: `${term}: ${definition}`,
            source_provision: ref,
          });
        }
      }
    }
  }

  return { provisions, definitions };
}

/**
 * Extract transitory articles from plain text.
 */
function extractTransitoryFromText(text: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  // Find the TRANSITORIOS section
  const transitoryIdx = text.search(/\n\s*(TRANSITORIOS?|ART[IÍ]CULOS?\s+TRANSITORIOS?)\s*\n/i);
  if (transitoryIdx === -1) return provisions;

  const transitoryText = text.substring(transitoryIdx);
  const lines = transitoryText.split('\n');

  // Match transitory article patterns
  const transRe = /^\s*(?:Art[ií]culo\s+)?(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO|[ÚU]NICO)\s*[\.\-]/i;

  const positions: { label: string; lineIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (transRe.test(lines[i])) {
      positions.push({ label: lines[i].trim().substring(0, 80), lineIdx: i });
    }
  }

  for (let i = 0; i < positions.length && i < 20; i++) {
    const pos = positions[i];
    const endIdx = i + 1 < positions.length ? positions[i + 1].lineIdx : lines.length;

    const content = lines.slice(pos.lineIdx, endIdx).join('\n').trim();
    if (content.length < 15) continue;

    provisions.push({
      provision_ref: `trans${i + 1}`,
      chapter: 'TRANSITORIOS',
      section: `Transitorio ${i + 1}`,
      title: pos.label,
      content: content.substring(0, 8000),
    });
  }

  return provisions;
}

/**
 * Parse plain text (from pdftotext) into structured law data.
 *
 * ACCURACY WARNING: PDF text extraction is not as accurate as parsing
 * digital (HTML/API) sources. The text may contain spacing artifacts,
 * encoding issues, or structural ambiguity from the PDF layout engine.
 * For the authoritative text, refer to the official PDF at
 * diputados.gob.mx/LeyesBiblio/pdf/{CODE}.pdf
 */
export function parseMexicanText(text: string, law: LawIndexEntry): ParsedLaw {
  if (text.length < 200) {
    console.log(`    WARNING: ${law.shortName} text too short (${text.length} chars)`);
    return {
      id: law.id,
      type: 'statute',
      title: law.title,
      title_en: law.titleEn,
      short_name: law.shortName,
      status: law.status,
      issued_date: law.issuedDate,
      in_force_date: law.inForceDate,
      url: law.url,
      description: law.description ?? law.title,
      provisions: [],
      definitions: [],
    };
  }

  // Clean PDF artifacts (headers, footers, page numbers, reform annotations)
  const cleanedText = cleanPdfText(text);

  const { provisions, definitions } = extractArticlesFromText(cleanedText);
  const transitoryProvisions = extractTransitoryFromText(cleanedText);

  return {
    id: law.id,
    type: 'statute',
    title: law.title,
    title_en: law.titleEn,
    short_name: law.shortName,
    status: law.status,
    issued_date: law.issuedDate,
    in_force_date: law.inForceDate,
    url: law.url,
    description: law.description ?? law.title,
    provisions: [...provisions, ...transitoryProvisions],
    definitions,
  };
}

/**
 * Pre-configured list of key Mexican federal laws to ingest.
 * These cover data protection, cybersecurity, fintech, commercial law,
 * consumer protection, and telecommunications.
 *
 * URL pattern: https://www.diputados.gob.mx/LeyesBiblio/ref/{code}.htm
 * PDF pattern: https://www.diputados.gob.mx/LeyesBiblio/pdf/{CODE}.pdf
 */
export const KEY_MEXICAN_ACTS: LawIndexEntry[] = [
  {
    id: 'lfpdppp',
    code: 'lfpdppp',
    title: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares',
    titleEn: 'Federal Law on Protection of Personal Data Held by Private Parties',
    shortName: 'LFPDPPP',
    status: 'in_force',
    issuedDate: '2010-07-05',
    inForceDate: '2010-07-06',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lfpdppp.htm',
    description: 'Mexico\'s primary private-sector data protection law (2010). Establishes ARCO rights (Access, Rectification, Cancellation, Opposition), consent requirements, privacy notices, cross-border transfer rules, and INAI oversight. Comparable to EU GDPR for private-sector data processing.',
  },
  {
    id: 'lgpdppso',
    code: 'lgpdppso',
    title: 'Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados',
    titleEn: 'General Law on Protection of Personal Data Held by Public Bodies',
    shortName: 'LGPDPPSO',
    status: 'in_force',
    issuedDate: '2017-01-26',
    inForceDate: '2017-01-27',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lgpdppso.htm',
    description: 'Public-sector data protection law (2017). Applies to all levels of government and autonomous bodies. Establishes data protection principles, ARCO rights for data held by public authorities, and requirements for data protection impact assessments.',
  },
  {
    id: 'lritf',
    code: 'lritf',
    title: 'Ley para Regular las Instituciones de Tecnología Financiera',
    titleEn: 'Law to Regulate Financial Technology Institutions (Fintech Law)',
    shortName: 'Ley Fintech',
    status: 'in_force',
    issuedDate: '2018-03-09',
    inForceDate: '2018-03-10',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lritf.htm',
    description: 'Fintech regulatory framework (2018). One of the most comprehensive in Latin America. Covers crowdfunding (ITF), e-money institutions (IFPE), virtual assets (crypto), open banking, regulatory sandboxes, and AML/CFT requirements for fintech operators.',
  },
  {
    id: 'cpf',
    code: 'cpf',
    title: 'Código Penal Federal',
    titleEn: 'Federal Criminal Code',
    shortName: 'Código Penal Federal',
    status: 'in_force',
    issuedDate: '1931-08-14',
    inForceDate: '1931-09-17',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/cpf.htm',
    description: 'Federal Criminal Code. Contains cybercrime provisions in Articles 211 bis 1-7 covering unauthorized access to computer systems, data interception, and information system sabotage. Also covers identity theft, fraud, and intellectual property crimes.',
  },
  {
    id: 'lgsm',
    code: 'lgsm',
    title: 'Ley General de Sociedades Mercantiles',
    titleEn: 'General Law on Commercial Companies',
    shortName: 'LGSM',
    status: 'in_force',
    issuedDate: '1934-08-04',
    inForceDate: '1934-08-04',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lgsm.htm',
    description: 'General Commercial Companies Law. Governs the formation, governance, and dissolution of commercial companies in Mexico (SA, S de RL, SAS, etc.). Relevant for corporate governance, director duties, and compliance obligations.',
  },
  {
    id: 'ccom',
    code: 'ccom',
    title: 'Código de Comercio',
    titleEn: 'Commercial Code',
    shortName: 'Código de Comercio',
    status: 'in_force',
    issuedDate: '1889-12-15',
    inForceDate: '1890-01-01',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/ccom.htm',
    description: 'Commercial Code. Governs commercial acts, electronic commerce (Título Segundo - Del Comercio Electrónico), commercial contracts, and merchant obligations. Contains provisions on electronic signatures and digital records.',
  },
  {
    id: 'lfpc',
    code: 'lfpc',
    title: 'Ley Federal de Protección al Consumidor',
    titleEn: 'Federal Consumer Protection Law',
    shortName: 'LFPC',
    status: 'in_force',
    issuedDate: '1992-12-24',
    inForceDate: '1993-03-25',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lfpc.htm',
    description: 'Federal Consumer Protection Law. Establishes consumer rights, advertising standards, e-commerce consumer protections, PROFECO enforcement powers, and collective action procedures. Contains provisions on digital transactions and online consumer rights.',
  },
  {
    id: 'cpeum',
    code: 'cpeum',
    title: 'Constitución Política de los Estados Unidos Mexicanos',
    titleEn: 'Political Constitution of the United Mexican States',
    shortName: 'Constitución',
    status: 'in_force',
    issuedDate: '1917-02-05',
    inForceDate: '1917-05-01',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/cpeum.htm',
    description: 'Constitution of Mexico (1917). Article 6 establishes the right to information and creates INAI. Article 16 establishes the fundamental right to privacy and data protection. Article 73 grants Congress power to legislate on data protection.',
  },
  {
    id: 'lftr',
    code: 'lftr',
    title: 'Ley Federal de Telecomunicaciones y Radiodifusión',
    titleEn: 'Federal Telecommunications and Broadcasting Law',
    shortName: 'LFTR',
    status: 'in_force',
    issuedDate: '2014-07-14',
    inForceDate: '2014-08-13',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lftr.htm',
    description: 'Federal Telecommunications and Broadcasting Law (2014). Establishes IFT (Federal Telecommunications Institute), net neutrality, user rights, data retention obligations for telecom carriers, cybersecurity reporting requirements, and critical infrastructure protections.',
  },
  {
    id: 'lfea',
    code: 'lfea',
    title: 'Ley de Firma Electrónica Avanzada',
    titleEn: 'Advanced Electronic Signature Law',
    shortName: 'Ley de Firma Electrónica',
    status: 'in_force',
    issuedDate: '2012-01-11',
    inForceDate: '2012-01-12',
    url: 'https://www.diputados.gob.mx/LeyesBiblio/ref/lfea.htm',
    description: 'Advanced Electronic Signature Law (2012). Governs the use of advanced electronic signatures (FIEL/e.firma) in government procedures, legal validity of electronic documents, certification service providers, and digital identity verification.',
  },
];
