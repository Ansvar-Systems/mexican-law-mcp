/**
 * Response metadata utilities for Mexican Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Diario Oficial de la Federación (diputados.gob.mx) — Mexican Chamber of Deputies',
    jurisdiction: 'MX',
    disclaimer:
      'This data is sourced from the Mexican Chamber of Deputies legislation portal. The authoritative versions are maintained by the Mexican federal government. Always verify with the official portal (diputados.gob.mx).',
    freshness,
  };
}
