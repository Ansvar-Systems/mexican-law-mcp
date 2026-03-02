# Tools — Mexican Law MCP

8 tools for searching and analyzing Mexican federal legislation.

## Core Tools (8)

### `search_legislation`

Full-text search across 45,179 provisions from 317 Mexican federal laws. Uses FTS5 with BM25 ranking and `unicode61` tokenizer for Spanish text. Returns matching provisions with `>>>` `<<<` highlight markers.

**Parameters:**
- `query` (required) — Search query (Spanish recommended). Supports FTS5 syntax: `"datos personales"` for exact phrase, `protección*` for prefix.
- `document_id` (optional) — Filter to a specific statute.
- `status` (optional) — Filter by `in_force`, `amended`, or `repealed`.
- `limit` (optional) — Max results, default 10, max 50.

### `get_provision`

Retrieve the full text of a specific article from a Mexican statute. Pass a `document_id` (law abbreviation, title, or internal ID) and optionally an article number.

**Parameters:**
- `document_id` (required) — Law identifier (e.g., `"LFPDPPP"`, `"CPEUM"`).
- `section` (optional) — Article number (e.g., `"1"`, `"16"`).
- `provision_ref` (optional) — Direct reference (e.g., `"art1"`).

### `validate_citation`

Validate a Mexican legal citation against the database. Checks that the law and provision exist, returns warnings for repealed/amended statutes.

**Parameters:**
- `citation` (required) — Citation string (e.g., `"Articulo 1 LFPDPPP"`, `"CPEUM art 16"`).

### `build_legal_stance`

Aggregate citations from multiple statutes for a legal question. Searches across all 317 laws and returns relevant provisions grouped by source.

**Parameters:**
- `query` (required) — Legal question or topic (e.g., `"datos personales"`, `"delitos informaticos"`).
- `document_id` (optional) — Limit to one statute.
- `limit` (optional) — Max results per category, default 5, max 20.

### `format_citation`

Format a citation per Mexican legal conventions. Three formats: `full` (formal with DOF reference), `short` (abbreviated), `pinpoint` (article only).

**Parameters:**
- `citation` (required) — Citation string to format.
- `format` (optional) — `"full"` (default), `"short"`, or `"pinpoint"`.

### `check_currency`

Check whether a Mexican statute is currently in force, amended, repealed, or not yet in force. Returns status, dates, and warnings.

**Parameters:**
- `document_id` (required) — Law identifier.
- `provision_ref` (optional) — Check a specific article.

### `list_sources`

Returns provenance metadata for all data sources: authority (Camara de Diputados), coverage scope, languages, and database statistics.

**Parameters:** None.

### `about`

Server metadata including version, database fingerprint, build date, document/provision counts, data source details, and extraction method.

**Parameters:** None.
