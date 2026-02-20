# Mexican Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/mexican-law-mcp)](https://www.npmjs.com/package/@ansvar/mexican-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/mexican-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/mexican-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/mexican-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Mexican federal legislation, including data protection (LFPDPPP), fintech regulation, cybercrime, commercial law, and consumer protection with Spanish full-text search.

## Deployment Tier

**MEDIUM** -- dual tier, free database bundled in npm package.

| Tier | Platform | Database | Content |
|------|----------|----------|---------|
| **Free** | Vercel (Hobby) / npm (stdio) | Core federal laws (~120-200 MB) | Key federal legislation (LFPDPPP, Ley Fintech, Codigo Penal Federal, Ley General de Sociedades Mercantiles, Codigo de Comercio, Ley Federal de Proteccion al Consumidor), FTS search, EU/international cross-references |
| **Professional** | Azure Container Apps / Docker / Local | Full database (~500 MB - 1 GB) | + All federal laws and reglamentos, INAI resolutions and guidelines, NOM standards, state-level key legislation |

## Key Legislation Covered

| Law | Year | Significance |
|-----|------|-------------|
| **LFPDPPP** | 2010 | Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares; comprehensive private-sector data protection law |
| **Ley General de Proteccion de Datos (Public Sector)** | 2017 | Data protection for public sector entities (Sujetos Obligados) |
| **Ley Fintech** | 2018 | Ley para Regular las Instituciones de Tecnologia Financiera; one of the most comprehensive fintech regulatory frameworks in Latin America |
| **Codigo Penal Federal** | Various | Cybercrime provisions (Articles 211bis 1-7) covering unauthorized access to computer systems |
| **Ley General de Sociedades Mercantiles** | Various | Commercial companies law governing incorporation and corporate governance |
| **Codigo de Comercio** | Various | Commercial code governing electronic commerce and commercial transactions |
| **Ley Federal de Proteccion al Consumidor** | Various | Consumer protection law administered by PROFECO |
| **Constitution of Mexico** | 1917 (amended) | Article 16 establishes the right to privacy and data protection as a fundamental right |

## Regulatory Context

- **Data Protection Regulator:** INAI (Instituto Nacional de Transparencia, Acceso a la Informacion y Proteccion de Datos Personales), a constitutional autonomous body
- **INAI** oversees both data protection (LFPDPPP) and freedom of information/transparency
- **INAI has faced political pressure** since 2023, with proposals to merge or dissolve it as part of broader autonomous body reforms; some commissioner positions have been vacant
- Mexico has **two separate DPA laws**: LFPDPPP (2010) for private sector and Ley General (2017) for public sector
- Mexico is a member of **APEC CBPR** (Cross-Border Privacy Rules), **OECD**, and has **USMCA/T-MEC** trade agreement with data flow provisions
- Mexico is a **civil law jurisdiction**; the DOF (Diario Oficial de la Federacion) is the official gazette

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Camara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/index.htm) | Camara de Diputados del H. Congreso de la Union | HTML/PDF Scrape | On change | Government Public Data | All federal laws with consolidated reform texts |
| [Orden Juridico Nacional](https://www.ordenjuridico.gob.mx) | Secretaria de Gobernacion | HTML Scrape | On change | Government Public Data | Constitution, federal laws, regulations, international treaties |
| [INAI](https://home.inai.org.mx) | INAI | HTML Scrape | On change | Government Public Data | LFPDPPP implementing regulations, guidelines, sanction resolutions |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/mexican-law-mcp
```

## Usage

### As stdio MCP server

```bash
mexican-law-mcp
```

### In Claude Desktop / MCP client configuration

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

### Vercel Streamable HTTP (ChatGPT / Claude.ai)

Once deployed, the public endpoint will be available at:

```
https://mexican-law-mcp.vercel.app/api/mcp
```

## Available Tools

| Tool | Description | Free Tier | Professional |
|------|-------------|-----------|-------------|
| `get_provision` | Retrieve a specific article from a Mexican federal law | Yes | Yes |
| `search_legislation` | Full-text search across all federal legislation (Spanish) | Yes | Yes |
| `list_laws` | List all available laws with metadata | Yes | Yes |
| `get_law_structure` | Get table of contents / structure of a law | Yes | Yes |
| `get_provision_eu_basis` | Cross-reference Mexican law to EU/international equivalents | Yes | Yes |
| `search_regulations` | Search federal regulations (reglamentos) and NOM standards | No (upgrade) | Yes |
| `get_inai_guidance` | Retrieve INAI guidelines and resolutions | No (upgrade) | Yes |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Build free-tier database
npm run build:db:free

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 4 article retrieval tests (LFPDPPP, Ley Fintech, Codigo Penal Federal, Ley General de Sociedades)
- 3 search tests (datos personales, ciberdelito, comercio electronico)
- 2 citation roundtrip tests (diputados.gob.mx / DOF references)
- 1 cross-reference test (LFPDPPP to GDPR/EU Directive)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](.github/SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/mexican-law-mcp/issues/new?template=data-error.md)

## Related Documents

- [MCP Quality Standard](../../mcp-quality-standard.md) -- quality requirements for all Ansvar MCPs
- [MCP Infrastructure Blueprint](../../mcp-infrastructure-blueprint.md) -- infrastructure implementation templates
- [MCP Deployment Tiers](../../mcp-deployment-tiers.md) -- free vs. professional tier strategy
- [MCP Server Registry](../../mcp-server-registry.md) -- operational registry of all MCPs
- [MCP Remote Access](../../mcp-remote-access.md) -- public Vercel endpoint URLs

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
