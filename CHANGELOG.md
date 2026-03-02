# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-03-02
### Changed
- **Full corpus ingestion** -- 317 federal laws (was 185), 45,179 provisions (was 583), 2,128 definitions
- **DOC-based extraction** via antiword replaces PDF-based extraction -- cleaner text, no page artifacts
- Census rebuilt from live index scrape -- all 317 correct codes from diputados.gob.mx
- Removed 5 EU-only tools (Mexico is not EU/EEA) -- `get_eu_basis`, `get_mexican_implementations`, `search_eu_implementations`, `get_provision_eu_basis`, `validate_eu_compliance`
- Removed EU database tables (`eu_documents`, `eu_references`)
- Fixed all tool descriptions -- replaced Australian references with Mexican equivalents
- Database size: ~69 MB (was 0.7 MB)

### Fixed
- Census code mismatch (93 wrong codes causing 404s)
- Version alignment: constants.ts, server.json, CHANGELOG all at 2.0.0
- Tool description grammar ("an Mexican" -> "a Mexican")
- search_legislation description: "Results are in Spanish" (was incorrectly "English")
- list_sources description: references Camara de Diputados (was Australian authority)
- db_metadata extraction_method: `doc-antiword` (was `pdf-pdftotext`)

## [1.0.0] - 2026-02-27
### Added
- Initial release of Mexican Law MCP
- `search_legislation` tool for full-text search across Mexican federal statutes (Spanish)
- `get_provision` tool for retrieving specific articles/sections
- `validate_citation` tool for legal citation validation
- `check_currency` tool for checking statute amendment status
- `build_legal_stance` tool for multi-source legal research
- `format_citation` tool for standard citation formatting
- `list_sources` tool for data provenance metadata
- `about` tool for server metadata and statistics
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (dual tier, bundled free DB)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/mexican-law-mcp/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Ansvar-Systems/mexican-law-mcp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ansvar-Systems/mexican-law-mcp/releases/tag/v1.0.0
