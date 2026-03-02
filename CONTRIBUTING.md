# Contributing to Mexican Law MCP

Contributions are welcome. This document covers the process and conventions.

## Getting Started

```bash
git clone https://github.com/Ansvar-Systems/mexican-law-mcp
cd mexican-law-mcp
npm install
npm run build
npm test
```

## Branch Strategy

This repository uses a `dev` branch. Never push directly to `main`.

```
feature-branch -> PR to dev -> verify on dev -> PR to main -> deploy
```

- Create feature branches from `dev`
- Open PRs targeting `dev`
- `main` is production — merges from `dev` only after verification

## Data Pipeline

The ingestion pipeline follows a census-first approach:

1. **Census** (`npm run census`) — enumerate all federal laws from diputados.gob.mx
2. **Ingest** (`npm run ingest`) — download DOC files, extract text via antiword, parse provisions
3. **Build** (`npm run build:db`) — compile seed files into SQLite database with FTS5

All law text comes from the Camara de Diputados official portal. No LLM-generated content.

## Testing

```bash
npm test              # Unit tests
npm run test:contract # Contract tests against golden fixtures
npm run lint          # TypeScript type checking
```

## Priority Areas

- Reglamentos (federal regulations) coverage
- State-level legislation
- Jurisprudencia (SCJN case law)
- Parser improvements for edge cases

## Code Quality

- TypeScript strict mode
- All SQL queries use parameterized statements
- ADR-009 anti-slop standard applies to all human-readable text

## Reporting Issues

- **Data errors** (wrong text, missing provisions): Use the [data error template](https://github.com/Ansvar-Systems/mexican-law-mcp/issues/new?template=data-error.md)
- **Security vulnerabilities**: See [SECURITY.md](.github/SECURITY.md)
- **Bugs and features**: Open a standard GitHub issue

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
