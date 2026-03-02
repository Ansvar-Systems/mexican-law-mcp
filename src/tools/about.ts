/**
 * about — Server metadata, dataset statistics, and provenance.
 */

import type Database from '@ansvar/mcp-sqlite';
import { detectCapabilities, readDbMetadata } from '../capabilities.js';
import { SERVER_NAME, SERVER_VERSION, REPOSITORY_URL } from '../constants.js';

export interface AboutContext {
  version: string;
  fingerprint: string;
  dbBuilt: string;
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export function getAbout(db: InstanceType<typeof Database>, context: AboutContext) {
  const caps = detectCapabilities(db);
  const meta = readDbMetadata(db);

  return {
    server: SERVER_NAME,
    version: context.version,
    repository: REPOSITORY_URL,
    database: {
      fingerprint: context.fingerprint,
      built_at: context.dbBuilt,
      tier: meta.tier,
      schema_version: meta.schema_version,
      capabilities: [...caps],
    },
    statistics: {
      documents: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
      provisions: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
      definitions: safeCount(db, 'SELECT COUNT(*) as count FROM definitions'),
    },
    data_source: {
      name: 'Cámara de Diputados — Leyes Federales Vigentes',
      authority: 'Cámara de Diputados del H. Congreso de la Unión, Mexico',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/index.htm',
      license: 'Government Public Data (public domain)',
      jurisdiction: 'MX',
      languages: ['es'],
      extraction_method: meta.extraction_method ?? 'doc-antiword',
      accuracy_notice: 'Text extracted from official DOC files using antiword. DOC extraction produces clean text without page headers/footers. For authoritative text, refer to the official source at diputados.gob.mx/LeyesBiblio/doc/{CODE}.doc',
    },
  };
}
