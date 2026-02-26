# Mexican Law MCP Server

**The Camara de Diputados alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fmexican-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/mexican-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/mexican-law-mcp?style=social)](https://github.com/Ansvar-Systems/mexican-law-mcp)
[![CI](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](#whats-included)
[![Provisions](https://img.shields.io/badge/provisions-583-blue)](#whats-included)

Query **185 Mexican federal statutes** -- from the Constitucion and LFPDPPP to the Ley Fintech, Codigo Penal Federal, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Mexican legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Mexican legal research is scattered across diputados.gob.mx, the Diario Oficial de la Federacion, ordenjuridico.gob.mx, and dozens of state-level sites. Whether you're:
- A **lawyer** validating citations in a contract or brief
- A **compliance officer** checking data protection requirements (LFPDPPP, LGPDPPSO)
- A **legal tech developer** building tools on Mexican law
- A **fintech company** navigating Ley Fintech requirements
- A **researcher** tracing legislative reforms

...you shouldn't need 47 browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Mexican law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mexican-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add mexican-law --transport http https://mexican-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mexican-law": {
      "type": "url",
      "url": "https://mexican-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "mexican-law": {
      "type": "http",
      "url": "https://mexican-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/mexican-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mexican-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/mexican-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "mexican-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/mexican-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally:

- *"What does Article 1 of the LFPDPPP say about data protection scope?"*
- *"Find provisions about datos personales in Mexican law"*
- *"What are the cybercrime provisions in the Codigo Penal Federal?"*
- *"What does the Ley Fintech say about virtual assets?"*
- *"List all Mexican federal laws related to consumer protection"*
- *"What are the ARCO rights under Mexican data protection law?"*
- *"Find provisions about firma electronica in the e-signature law"*
- *"What does Article 6 of the Constitution say about the right to information?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Constitution** | 1 | Constitucion Politica de los Estados Unidos Mexicanos |
| **Federal Codes** | 9 | Civil, Commercial, Criminal, Tax, Procedure, Military Justice |
| **Federal Laws** | 116 | Data protection, fintech, telecom, labor, competition, etc. |
| **General Laws** | 43 | Health, education, environment, transparency, anti-corruption |
| **Organic Laws** | 9 | Judiciary, Congress, Public Administration, Attorney General |
| **Regulatory Laws** | 6 | Agrarian, mining, nuclear energy, professional practice |
| **Other** | 1 | Statutes |
| **Total Statutes** | 185 | Comprehensive Mexican federal legislation |
| **Provisions** | 583 | Full-text searchable with FTS5 (unicode61 for Spanish) |
| **Definitions** | 56 | Legal term definitions extracted from statutes |
| **Database Size** | ~0.7 MB | Optimized SQLite, portable |

**Verified data only** -- every citation is validated against official sources (diputados.gob.mx). Zero LLM-generated content.

---

## Key Law Categories

### Data Protection and Privacy
- **LFPDPPP** -- Federal Law on Protection of Personal Data Held by Private Parties (2010)
- **LGPDPPSO** -- General Law on Protection of Personal Data Held by Public Bodies (2017)

### Financial Technology and Banking
- **Ley Fintech** -- Law to Regulate Financial Technology Institutions (2018)
- **LIC** -- Credit Institutions Law
- **LMV** -- Securities Market Law
- **Ley Banxico** -- Bank of Mexico Law

### Cybercrime and Digital
- **Codigo Penal Federal** -- Federal Criminal Code (Articles 211 bis 1-7: cybercrime)
- **Ley de Firma Electronica** -- Advanced Electronic Signature Law (2012)
- **Codigo de Comercio** -- Commercial Code (e-commerce provisions)

### Consumer Protection and Competition
- **LFPC** -- Federal Consumer Protection Law
- **LFCE** -- Federal Economic Competition Law

### Corporate and Commercial
- **LGSM** -- General Law on Commercial Companies
- **Ley de Concursos** -- Commercial Insolvency Law

### Anti-Money Laundering
- **Ley Antilavado** -- Federal Anti-Money Laundering Law

### Transparency and Access to Information
- **LFTAIP** -- Federal Transparency and Access to Public Information Law
- **LGTAIP** -- General Transparency and Access to Public Information Law

---

## Available Tools (8)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search on 583 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by law + article number |
| `list_laws` | List all 185 statutes with metadata |
| `get_preparatory_works` | Get linked reform history for a statute |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from multiple statutes |
| `format_citation` | Format citations per Mexican conventions (DOF reference) |
| `check_currency` | Check if statute is in force, amended, or repealed |

---

## Data Sources and Freshness

All content is sourced from authoritative Mexican legal databases:

- **[Camara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/)** -- Official federal legislation compilation
- **[Diario Oficial de la Federacion](https://www.dof.gob.mx/)** -- Official gazette for all legislation
- **[Orden Juridico Nacional](https://www.ordenjuridico.gob.mx/)** -- Federal Legal Order reference

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources for reforms published in the Diario Oficial de la Federacion.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Camara de Diputados publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Verify critical citations** against primary sources (DOF, diputados.gob.mx) for court filings
> - Mexican law is complex -- federal vs. state jurisdiction matters
> - Reforms may have transitional provisions not fully captured

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/mexican-law-mcp
cd mexican-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run census                             # Enumerate all federal laws
npm run ingest                             # Full corpus ingestion from census
npm run ingest -- --resume                 # Resume interrupted ingestion
npm run ingest -- --limit 5                # Test with 5 laws
npm run ingest -- --skip-fetch             # Reuse cached HTML
npm run build:db                           # Rebuild SQLite database
npm run check-updates                      # Check for amendments
```

### Census-First Workflow

```
census.ts -> data/census.json (185 laws)
    |
ingest.ts -> data/seed/*.json (per-law provision JSON)
    |
build-db.ts -> data/database.db (SQLite + FTS5)
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~0.7 MB (efficient, portable)
- **FTS5 Tokenizer:** unicode61 (optimized for Spanish accented text)

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/swedish-law-mcp](https://github.com/Ansvar-Systems/swedish-law-mcp)
**Query 2,415 Swedish statutes directly from Claude** -- with EU cross-references. `npx @ansvar/swedish-law-mcp`

### [@ansvar/canadian-law-mcp](https://github.com/Ansvar-Systems/canadian-law-mcp)
**Query Canadian federal legislation** -- consolidated Acts from Justice Laws Website. `npx @ansvar/canadian-law-mcp`

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Full corpus re-ingestion when diputados.gob.mx is accessible
- State-level legislation coverage
- Reglamentos (federal regulations) ingestion
- Jurisprudencia (judicial precedent) integration
- English translations for key statutes

---

## Roadmap

- [x] **Census-first architecture** -- 185 federal laws enumerated
- [x] **Core law ingestion** -- LFPDPPP, Ley Fintech, Codigo Penal, and 7 more fully parsed
- [x] **FTS5 with unicode61** -- Optimized for Spanish text search
- [ ] Full corpus re-ingestion (pending diputados.gob.mx availability)
- [ ] Reglamentos coverage (80+ federal regulations)
- [ ] State-level legislation
- [ ] Jurisprudencia (SCJN case law)
- [ ] English translations for key statutes

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{mexican_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Mexican Law MCP Server: Federal Legislation Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/mexican-law-mcp},
  note = {185 Mexican federal statutes with Spanish full-text search}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Federal Legislation:** Mexican Government (public domain under Article 14 of the Federal Copyright Law -- government works are not subject to copyright)
- **Source:** Camara de Diputados, diputados.gob.mx/LeyesBiblio

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools. This MCP server makes Mexican federal law searchable, cross-referenceable, and AI-readable.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
