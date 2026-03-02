# Mexican Law MCP Server

**The DOF (Diario Oficial de la Federación) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fmexican-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/mexican-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/mexican-law-mcp?style=social)](https://github.com/Ansvar-Systems/mexican-law-mcp)
[![CI](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-45%2C179-blue)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)

Consulte **317 leyes federales mexicanas** -- desde la LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares) y el Código Penal Federal hasta el Código Civil Federal, la Ley Federal del Trabajo, y más -- directamente desde Claude, Cursor o cualquier cliente compatible con MCP.

If you're building legal tech, compliance tools, or doing Mexican legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Por qué existe esto

La investigación jurídica federal mexicana está dispersa entre dof.gob.mx, diputados.gob.mx, ordenjuridico.gob.mx, y las publicaciones de la Cámara de Diputados. Ya sea que usted sea:
- Un **abogado** validando citas en un escrito o contrato
- Un **oficial de cumplimiento** verificando las obligaciones de la LFPDPPP o regulaciones del INAI
- Un **desarrollador legaltech** construyendo herramientas sobre el derecho mexicano
- Un **investigador** rastreando legislación federal a través de 317 leyes

...no debería necesitar docenas de pestañas en el navegador y búsqueda manual de PDFs. Pregúntele a Claude. Obtenga la disposición exacta. Con contexto.

Este servidor MCP hace que el derecho mexicano sea **consultable, referenciable y legible por IA**.

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

---

## Ejemplos de Consultas

Una vez conectado, pregunte naturalmente:

- *"Buscar 'protección de datos personales' en la LFPDPPP"*
- *"¿Qué dice el Código Penal Federal sobre delitos informáticos?"*
- *"Encontrar disposiciones sobre rescisión del contrato de trabajo en la Ley Federal del Trabajo"*
- *"¿El Código Civil Federal sigue en vigor?"*
- *"¿Cuáles son las obligaciones del responsable bajo la LFPDPPP?"*
- *"Buscar derechos ARCO (acceso, rectificación, cancelación y oposición) en la LFPDPPP"*
- *"¿Cómo se alinea la LFPDPPP con los principios internacionales de protección de datos?"*
- *"Validar la cita: LFPDPPP, Artículo 16"*
- *"Construir una posición jurídica sobre las obligaciones de privacidad en México"*
- *"Encontrar disposiciones sobre protección al consumidor en la LFPC"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Federal Laws** | 317 laws | Comprehensive Mexican federal legislation |
| **Provisions** | 45,179 sections | Full-text searchable with FTS5 |
| **Agency Guidance** | 73,287 documents | INAI, COFECE, CNBV regulatory guidance |
| **Database Size** | ~0.7 MB | Optimized SQLite, portable |
| **Language** | Spanish | Official language of Mexican federal law |
| **Freshness Checks** | Automated | Drift detection against DOF and Cámara de Diputados |

### Key Laws Included

| Law | Description |
|-----|-------------|
| LFPDPPP | Ley Federal de Protección de Datos Personales en Posesión de los Particulares |
| Código Penal Federal | Federal Criminal Code |
| Código Civil Federal | Federal Civil Code |
| Ley Federal del Trabajo (LFT) | Federal Labour Law |
| LFPC (Ley Federal de Protección al Consumidor) | Federal Consumer Protection Law |
| Ley FinTech (Ley para Regular las ITF) | Financial Technology Law |
| Ley Federal de Telecomunicaciones y Radiodifusión (LFTR) | Telecommunications Law |
| Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados | Public sector data protection |

**Verified data only** -- every citation is validated against official sources (dof.gob.mx, diputados.gob.mx). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from diputados.gob.mx and dof.gob.mx official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains law text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 ranking (safe for context)
- Provision retrieval gives exact text by law name + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
DOF / Cámara de Diputados --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                 ^                        ^
                          Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Enfoque Tradicional | Este Servidor MCP |
|--------------------|-------------------|
| Buscar en dof.gob.mx por nombre de ley | Buscar en español: *"protección datos personales consentimiento"* |
| Navegar manualmente en códigos de varios artículos | Obtener la disposición exacta con contexto |
| Referencias cruzadas manuales entre leyes | `build_legal_stance` agrega de múltiples fuentes |
| "¿Esta ley sigue en vigor?" -- verificar manualmente | Herramienta `check_currency` -- respuesta en segundos |
| Comparar con estándares OCDE -- buscar manualmente | `get_eu_basis` -- marcos internacionales vinculados al instante |
| Sin API, sin integración | Protocolo MCP -- nativo para IA |

**Tradicional:** Buscar en diputados.gob.mx --> Descargar PDF --> Ctrl+F en español --> Referencias cruzadas con otra ley --> Verificar lineamientos del INAI --> Repetir

**Este MCP:** *"¿Cuáles son las bases legales para el tratamiento de datos personales bajo la LFPDPPP y cómo se comparan con los estándares de la OCDE?"* --> Listo.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 45,179 provisions with BM25 ranking. Supports Spanish full-text queries |
| `get_provision` | Retrieve specific provision by law name + article number |
| `check_currency` | Check if a law is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple laws for a legal topic |
| `format_citation` | Format citations per Mexican conventions (full/short/pinpoint) |
| `list_sources` | List all available laws with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (USMCA, OECD, OAS) that a Mexican law aligns with |
| `get_mexican_implementations` | Find Mexican laws implementing a specific international instrument |
| `search_eu_implementations` | Search international documents with Mexican implementation counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Mexican laws against international frameworks |

---

## International Law Alignment

Mexico is not an EU member state. Mexican law aligns with international frameworks through:

- **USMCA (T-MEC)** -- Mexico, United States, and Canada trade agreement; Chapter 19 on Digital Trade includes data protection and cross-border data flow provisions aligned with international standards
- **OECD** -- Mexico is an OECD member since 1994; the LFPDPPP was developed in alignment with OECD Privacy Guidelines and the OECD Guidelines on the Security of Information Systems
- **OAS (OEA)** -- Organization of American States frameworks for cybersecurity and data protection
- **Council of Europe Convention 108** -- Mexico's LFPDPPP aligns with Convention 108 principles on personal data protection, even though Mexico is not a signatory
- **Ilustre y Nacional Colegio de Abogados de México (INCAM) / Barra Mexicana - Colegio de Abogados** -- Professional legal practice regulated by INCAM and the Barra Mexicana

The international bridge tools allow you to explore these alignment relationships -- checking which Mexican provisions correspond to USMCA, OECD, or international data protection principles, and vice versa.

> **Note:** International cross-references reflect alignment and treaty obligation relationships. Mexico adopts its own legislative approach, and the tools help identify where Mexican and international law address the same domains.

---

## Data Sources & Freshness

All content is sourced from authoritative Mexican legal databases:

- **[Diario Oficial de la Federación (DOF)](https://dof.gob.mx/)** -- Official federal gazette, primary source for enacted legislation
- **[Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/)** -- Chamber of Deputies consolidated law library (primary source for this database)
- **[Orden Jurídico Nacional](https://ordenjuridico.gob.mx/)** -- Secretaría de Gobernación legal framework portal

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Cámara de Diputados del H. Congreso de la Unión |
| **Language** | Spanish |
| **Coverage** | 317 federal laws across all legislative areas |
| **Agency Guidance** | 73,287 INAI, COFECE, CNBV regulatory documents |
| **Last ingested** | 2026-02-28 |

### Automated Freshness Checks

A GitHub Actions workflow monitors all data sources:

| Check | Method |
|-------|--------|
| **Law amendments** | Drift detection against known provision anchors |
| **New laws** | Comparison against Cámara de Diputados index |
| **Repealed laws** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

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
> Statute text is sourced from the Cámara de Diputados and the Diario Oficial de la Federación. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law (jurisprudencia) research
> - **Verify critical citations** against primary sources (dof.gob.mx) for official proceedings
> - **International cross-references** reflect alignment relationships, not formal transposition
> - **State-level legislation is not included** -- this covers federal Acts only
> - For professional legal advice in Mexico, consult a member of the **Ilustre y Nacional Colegio de Abogados de México (INCAM)** or the **Barra Mexicana - Colegio de Abogados**

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment.

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
npm run ingest              # Ingest laws from DOF/Cámara de Diputados
npm run build:db            # Rebuild SQLite database
npm run check-updates       # Check for amendments and new laws
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~0.7 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, China, Denmark, Finland, France, Germany, Ghana, Iceland, India, Ireland, Israel, Italy, Japan, Kenya, Netherlands, Nigeria, Norway, Singapore, Slovenia, South Korea, Sweden, Switzerland, Thailand, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (SCJN jurisprudencia, Tesis)
- INAI and COFECE regulatory resolutions
- State-level legislation summaries
- Historical law versions and amendment tracking

---

## Roadmap

- [x] Core law database with FTS5 search
- [x] Full corpus ingestion (317 laws, 45,179 provisions)
- [x] Agency guidance (73,287 documents from INAI, COFECE, CNBV)
- [x] International law alignment tools (USMCA, OECD, OAS)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion (SCJN jurisprudencia)
- [ ] INAI resolution and guideline coverage expansion
- [ ] Historical law versions (amendment tracking)
- [ ] State-level legislation

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{mexican_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Mexican Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/mexican-law-mcp},
  note = {317 Mexican federal laws with 45,179 provisions and 73,287 agency guidance documents}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Cámara de Diputados del H. Congreso de la Unión (public domain)
- **Agency Guidance:** INAI, COFECE, CNBV (public domain)
- **International References:** OECD, OAS (public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Mexican legal research -- turns out everyone building compliance tools for the Latin American market has the same research frustrations.

So we're open-sourcing it. Navigating 317 federal laws across the DOF and Cámara de Diputados shouldn't take hours.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
