#!/usr/bin/env tsx
/**
 * Mexican Law MCP — Ingestion Pipeline
 *
 * Fetches Mexican federal legislation from Cámara de Diputados (diputados.gob.mx).
 * Downloads HTML pages for each law and parses the structured content into
 * provision-level JSON seed files.
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 laws
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *
 * Mexican legislation is public domain as government publication.
 * The Cámara de Diputados maintains the official compilation of all federal laws.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLawHtml } from './lib/fetcher.js';
import { parseMexicanHtml, KEY_MEXICAN_ACTS, type LawIndexEntry, type ParsedLaw } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

/**
 * Create a fallback seed with law metadata when fetching fails.
 * This ensures the database always has the law entries even if the
 * upstream source is unreachable.
 */
function createFallbackSeed(law: LawIndexEntry): ParsedLaw {
  console.log(`    Creating fallback seed for ${law.shortName}`);
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
    provisions: [
      {
        provision_ref: 'art1',
        section: '1',
        title: `${law.shortName} - Artículo 1`,
        content: `${law.title}. ${law.description ?? ''}. Texto completo disponible en: ${law.url}`,
      },
    ],
    definitions: [],
  };
}

async function fetchAndParseLaws(laws: LawIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nProcessing ${laws.length} federal laws...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let fallbacks = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  const report: { law: string; provisions: number; definitions: number; status: string }[] = [];

  for (const law of laws) {
    const sourceFile = path.join(SOURCE_DIR, `${law.id}.html`);
    const seedFile = path.join(SEED_DIR, `${law.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedLaw;
      report.push({
        law: law.shortName,
        provisions: existing.provisions.length,
        definitions: existing.definitions.length,
        status: 'cached',
      });
      totalProvisions += existing.provisions.length;
      totalDefinitions += existing.definitions.length;
      skipped++;
      processed++;
      continue;
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`  Using cached ${law.shortName} (${law.code})`);
      } else {
        process.stdout.write(`  Fetching ${law.shortName} (${law.code})...`);
        const result = await fetchLawHtml(law.code);

        if (result.status !== 200) {
          console.log(` HTTP ${result.status} -- creating fallback`);
          const fallbackSeed = createFallbackSeed(law);
          fs.writeFileSync(seedFile, JSON.stringify(fallbackSeed, null, 2));
          report.push({ law: law.shortName, provisions: fallbackSeed.provisions.length, definitions: 0, status: `HTTP ${result.status} (fallback)` });
          totalProvisions += fallbackSeed.provisions.length;
          fallbacks++;
          processed++;
          continue;
        }

        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseMexicanHtml(html, law);

      // If parsing returned zero provisions, create fallback
      if (parsed.provisions.length === 0) {
        console.log(`    WARNING: No provisions parsed for ${law.shortName}, creating fallback`);
        const fallbackSeed = createFallbackSeed(law);
        fs.writeFileSync(seedFile, JSON.stringify(fallbackSeed, null, 2));
        report.push({ law: law.shortName, provisions: fallbackSeed.provisions.length, definitions: 0, status: 'parse-empty (fallback)' });
        totalProvisions += fallbackSeed.provisions.length;
        fallbacks++;
      } else {
        fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
        totalProvisions += parsed.provisions.length;
        totalDefinitions += parsed.definitions.length;
        report.push({
          law: law.shortName,
          provisions: parsed.provisions.length,
          definitions: parsed.definitions.length,
          status: 'OK',
        });
        console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${law.shortName}: ${msg}`);

      // Create fallback seed on error
      const fallbackSeed = createFallbackSeed(law);
      fs.writeFileSync(seedFile, JSON.stringify(fallbackSeed, null, 2));
      report.push({ law: law.shortName, provisions: fallbackSeed.provisions.length, definitions: 0, status: `ERROR (fallback): ${msg.substring(0, 50)}` });
      totalProvisions += fallbackSeed.provisions.length;
      fallbacks++;
      failed++;
    }

    processed++;
  }

  // Print summary report
  console.log(`\n${'='.repeat(80)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(80));
  console.log(`${'Law'.padEnd(30)} ${'Provisions'.padEnd(12)} ${'Definitions'.padEnd(12)} Status`);
  console.log('-'.repeat(80));

  for (const r of report) {
    console.log(
      `${r.law.padEnd(30)} ${String(r.provisions).padEnd(12)} ${String(r.definitions).padEnd(12)} ${r.status}`
    );
  }

  console.log('-'.repeat(80));
  console.log(`${'TOTAL'.padEnd(30)} ${String(totalProvisions).padEnd(12)} ${String(totalDefinitions).padEnd(12)}`);
  console.log(`\n  Laws processed: ${processed}`);
  console.log(`  Laws cached:    ${skipped}`);
  console.log(`  Laws fallback:  ${fallbacks}`);
  console.log(`  Laws failed:    ${failed}`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Mexican Law MCP -- Ingestion Pipeline');
  console.log('=====================================\n');
  console.log(`  Source:  Cámara de Diputados (diputados.gob.mx/LeyesBiblio)`);
  console.log(`  Method:  HTML scrape (ref/*.htm)`);
  console.log(`  License: Government Public Data (public domain)`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const laws = limit ? KEY_MEXICAN_ACTS.slice(0, limit) : KEY_MEXICAN_ACTS;
  await fetchAndParseLaws(laws, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
