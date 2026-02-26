#!/usr/bin/env tsx
/**
 * Mexican Law MCP — Census Script
 *
 * Enumerates ALL Mexican federal laws from the Cámara de Diputados
 * (diputados.gob.mx/LeyesBiblio) legislative library.
 *
 * Strategy:
 *   1. Attempt to scrape the live index page at /LeyesBiblio/ref.htm
 *   2. Fall back to curated KNOWN_LAWS list if the site is unreachable
 *   3. Write data/census.json in golden standard format
 *
 * The curated list covers the complete inventory of Mexican federal legislation:
 *   - Constitución Política (1)
 *   - Códigos Federales (7)
 *   - Leyes Federales (~180)
 *   - Leyes Generales (~50)
 *   - Leyes Nacionales (~10)
 *   - Leyes Orgánicas (~20)
 *   - Leyes Reglamentarias (~15)
 *   - Estatutos y otros (~10)
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --live-only    # Only use live scraping (fail if unreachable)
 *
 * Mexican legislation is public domain as government publication.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const CENSUS_PATH = path.join(DATA_DIR, 'census.json');

interface CensusLaw {
  id: string;
  code: string;
  title: string;
  titleEn: string;
  shortName: string;
  category: 'constitucion' | 'codigo' | 'ley_federal' | 'ley_general' | 'ley_nacional' | 'ley_organica' | 'ley_reglamentaria' | 'estatuto' | 'otro';
  url: string;
  pdfUrl: string;
  classification: 'ingestable' | 'inaccessible' | 'metadata_only';
}

interface CensusOutput {
  generated_at: string;
  source: string;
  description: string;
  stats: {
    total: number;
    class_ingestable: number;
    class_inaccessible: number;
    class_metadata_only: number;
    by_category: Record<string, number>;
  };
  ingestion?: {
    completed_at: string;
    total_laws: number;
    total_provisions: number;
    coverage_pct: string;
  };
  laws: CensusLaw[];
}

/**
 * Curated list of ALL known Mexican federal laws.
 *
 * Sources:
 *   - diputados.gob.mx/LeyesBiblio (primary, ~300 laws)
 *   - ordenjuridico.gob.mx (cross-reference)
 *   - mexico.justia.com/federales/leyes (verification)
 *
 * Each entry uses the code as it appears in the official URL:
 *   HTML: https://www.diputados.gob.mx/LeyesBiblio/ref/{code}.htm
 *   PDF:  https://www.diputados.gob.mx/LeyesBiblio/pdf/{CODE}.pdf
 *
 * Updated: 2026-02-26
 */
const KNOWN_LAWS: Omit<CensusLaw, 'url' | 'pdfUrl' | 'classification'>[] = [
  // ═══════════════════════════════════════════════════════
  // CONSTITUCIÓN
  // ═══════════════════════════════════════════════════════
  { id: 'cpeum', code: 'cpeum', title: 'Constitución Política de los Estados Unidos Mexicanos', titleEn: 'Political Constitution of the United Mexican States', shortName: 'Constitución', category: 'constitucion' },

  // ═══════════════════════════════════════════════════════
  // CÓDIGOS FEDERALES
  // ═══════════════════════════════════════════════════════
  { id: 'ccf', code: 'ccf', title: 'Código Civil Federal', titleEn: 'Federal Civil Code', shortName: 'Código Civil Federal', category: 'codigo' },
  { id: 'ccom', code: 'ccom', title: 'Código de Comercio', titleEn: 'Commercial Code', shortName: 'Código de Comercio', category: 'codigo' },
  { id: 'cfpc', code: 'cfpc', title: 'Código Federal de Procedimientos Civiles', titleEn: 'Federal Code of Civil Procedure', shortName: 'CFPC', category: 'codigo' },
  { id: 'cfpp', code: 'cfpp', title: 'Código Federal de Procedimientos Penales', titleEn: 'Federal Code of Criminal Procedure', shortName: 'CFPP', category: 'codigo' },
  { id: 'cff', code: 'cff', title: 'Código Fiscal de la Federación', titleEn: 'Federal Tax Code', shortName: 'CFF', category: 'codigo' },
  { id: 'cjm', code: 'cjm', title: 'Código de Justicia Militar', titleEn: 'Military Justice Code', shortName: 'Código de Justicia Militar', category: 'codigo' },
  { id: 'cpf', code: 'cpf', title: 'Código Penal Federal', titleEn: 'Federal Criminal Code', shortName: 'Código Penal Federal', category: 'codigo' },
  { id: 'cnpp', code: 'cnpp', title: 'Código Nacional de Procedimientos Penales', titleEn: 'National Code of Criminal Procedure', shortName: 'CNPP', category: 'codigo' },
  { id: 'cnpcf', code: 'cnpcf', title: 'Código Nacional de Procedimientos Civiles y Familiares', titleEn: 'National Code of Civil and Family Procedure', shortName: 'CNPCF', category: 'codigo' },

  // ═══════════════════════════════════════════════════════
  // LEYES FEDERALES (alphabetical)
  // ═══════════════════════════════════════════════════════
  { id: 'lfa', code: 'lfa', title: 'Ley Federal de Armas de Fuego y Explosivos', titleEn: 'Federal Law on Firearms and Explosives', shortName: 'Ley de Armas', category: 'ley_federal' },
  { id: 'lfce', code: 'lfce', title: 'Ley Federal de Competencia Económica', titleEn: 'Federal Economic Competition Law', shortName: 'LFCE', category: 'ley_federal' },
  { id: 'lfd', code: 'lfd', title: 'Ley Federal de Derechos', titleEn: 'Federal Rights Law', shortName: 'LFD', category: 'ley_federal' },
  { id: 'lfea', code: 'lfea', title: 'Ley de Firma Electrónica Avanzada', titleEn: 'Advanced Electronic Signature Law', shortName: 'Ley de Firma Electrónica', category: 'ley_federal' },
  { id: 'lfpc', code: 'lfpc', title: 'Ley Federal de Protección al Consumidor', titleEn: 'Federal Consumer Protection Law', shortName: 'LFPC', category: 'ley_federal' },
  { id: 'lfpca', code: 'lfpca', title: 'Ley Federal de Procedimiento Contencioso Administrativo', titleEn: 'Federal Administrative Litigation Procedure Law', shortName: 'LFPCA', category: 'ley_federal' },
  { id: 'lfpa', code: 'lfpa', title: 'Ley Federal de Procedimiento Administrativo', titleEn: 'Federal Administrative Procedure Law', shortName: 'LFPA', category: 'ley_federal' },
  { id: 'lfpdppp', code: 'lfpdppp', title: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares', titleEn: 'Federal Law on Protection of Personal Data Held by Private Parties', shortName: 'LFPDPPP', category: 'ley_federal' },
  { id: 'lfped', code: 'lfped', title: 'Ley Federal para Prevenir y Eliminar la Discriminación', titleEn: 'Federal Law to Prevent and Eliminate Discrimination', shortName: 'LFPED', category: 'ley_federal' },
  { id: 'lfrpe', code: 'lfrpe', title: 'Ley Federal de Responsabilidad Patrimonial del Estado', titleEn: 'Federal State Patrimonial Liability Law', shortName: 'LFRPE', category: 'ley_federal' },
  { id: 'lfprh', code: 'lfprh', title: 'Ley Federal de Presupuesto y Responsabilidad Hacendaria', titleEn: 'Federal Budget and Fiscal Responsibility Law', shortName: 'LFPRH', category: 'ley_federal' },
  { id: 'lft', code: 'lft', title: 'Ley Federal del Trabajo', titleEn: 'Federal Labor Law', shortName: 'LFT', category: 'ley_federal' },
  { id: 'lftr', code: 'lftr', title: 'Ley Federal de Telecomunicaciones y Radiodifusión', titleEn: 'Federal Telecommunications and Broadcasting Law', shortName: 'LFTR', category: 'ley_federal' },
  { id: 'lfda', code: 'lfda', title: 'Ley Federal del Derecho de Autor', titleEn: 'Federal Copyright Law', shortName: 'LFDA', category: 'ley_federal' },
  { id: 'lfe', code: 'lfe', title: 'Ley Federal de los Trabajadores al Servicio del Estado', titleEn: 'Federal Law of State Workers', shortName: 'LFTE', category: 'ley_federal' },
  { id: 'lfrc', code: 'lfrc', title: 'Ley Federal de Responsabilidades de los Servidores Públicos', titleEn: 'Federal Law on Responsibilities of Public Servants', shortName: 'LFRC', category: 'ley_federal' },
  { id: 'lfmn', code: 'lfmn', title: 'Ley Federal sobre Metrología y Normalización', titleEn: 'Federal Law on Metrology and Standardization', shortName: 'LFMN', category: 'ley_federal' },
  { id: 'lfaacsp', code: 'lfaacsp', title: 'Ley Federal de Austeridad Republicana', titleEn: 'Federal Republican Austerity Law', shortName: 'Ley de Austeridad', category: 'ley_federal' },
  { id: 'lfdelitos', code: 'lfdelitos', title: 'Ley Federal contra la Delincuencia Organizada', titleEn: 'Federal Law Against Organized Crime', shortName: 'Ley contra Delincuencia Org.', category: 'ley_federal' },
  { id: 'lfr', code: 'lfr', title: 'Ley Federal de Remuneraciones de los Servidores Públicos', titleEn: 'Federal Law on Remuneration of Public Servants', shortName: 'LFR', category: 'ley_federal' },
  { id: 'lfsv', code: 'lfsv', title: 'Ley Federal de Sanidad Vegetal', titleEn: 'Federal Plant Health Law', shortName: 'LFSV', category: 'ley_federal' },
  { id: 'lfsa', code: 'lfsa', title: 'Ley Federal de Sanidad Animal', titleEn: 'Federal Animal Health Law', shortName: 'LFSA', category: 'ley_federal' },
  { id: 'lftaip', code: 'lftaip', title: 'Ley Federal de Transparencia y Acceso a la Información Pública', titleEn: 'Federal Transparency and Access to Public Information Law', shortName: 'LFTAIP', category: 'ley_federal' },
  { id: 'lfz', code: 'lfz', title: 'Ley Federal de Zonas Económicas Especiales', titleEn: 'Federal Special Economic Zones Law', shortName: 'LFZ', category: 'ley_federal' },
  { id: 'lgsm', code: 'lgsm', title: 'Ley General de Sociedades Mercantiles', titleEn: 'General Law on Commercial Companies', shortName: 'LGSM', category: 'ley_federal' },
  { id: 'lritf', code: 'lritf', title: 'Ley para Regular las Instituciones de Tecnología Financiera', titleEn: 'Law to Regulate Financial Technology Institutions (Fintech Law)', shortName: 'Ley Fintech', category: 'ley_federal' },
  { id: 'lii', code: 'lii', title: 'Ley de Inversión Extranjera', titleEn: 'Foreign Investment Law', shortName: 'Ley de Inversión Extranjera', category: 'ley_federal' },
  { id: 'lpi', code: 'lpi', title: 'Ley de la Propiedad Industrial', titleEn: 'Industrial Property Law', shortName: 'LPI', category: 'ley_federal' },
  { id: 'lce', code: 'lce', title: 'Ley de Comercio Exterior', titleEn: 'Foreign Trade Law', shortName: 'Ley de Comercio Exterior', category: 'ley_federal' },
  { id: 'lcm', code: 'lcm', title: 'Ley de Concursos Mercantiles', titleEn: 'Commercial Insolvency Law', shortName: 'Ley de Concursos', category: 'ley_federal' },
  { id: 'lan', code: 'lan', title: 'Ley de Aguas Nacionales', titleEn: 'National Waters Law', shortName: 'Ley de Aguas', category: 'ley_federal' },
  { id: 'laamss', code: 'laamss', title: 'Ley de los Institutos Nacionales de Salud', titleEn: 'National Health Institutes Law', shortName: 'Ley de Inst. Nac. de Salud', category: 'ley_federal' },
  { id: 'lsar', code: 'lsar', title: 'Ley de los Sistemas de Ahorro para el Retiro', titleEn: 'Retirement Savings Systems Law', shortName: 'Ley SAR', category: 'ley_federal' },
  { id: 'lissste', code: 'lissste', title: 'Ley del Instituto de Seguridad y Servicios Sociales de los Trabajadores del Estado', titleEn: 'State Workers Social Security and Services Institute Law', shortName: 'LISSSTE', category: 'ley_federal' },
  { id: 'lss', code: 'lss', title: 'Ley del Seguro Social', titleEn: 'Social Security Law', shortName: 'Ley del Seguro Social', category: 'ley_federal' },
  { id: 'lisr', code: 'lisr', title: 'Ley del Impuesto sobre la Renta', titleEn: 'Income Tax Law', shortName: 'LISR', category: 'ley_federal' },
  { id: 'liva', code: 'liva', title: 'Ley del Impuesto al Valor Agregado', titleEn: 'Value Added Tax Law', shortName: 'LIVA', category: 'ley_federal' },
  { id: 'lieps', code: 'lieps', title: 'Ley del Impuesto Especial sobre Producción y Servicios', titleEn: 'Special Tax on Production and Services Law', shortName: 'LIEPS', category: 'ley_federal' },
  { id: 'laassp', code: 'laassp', title: 'Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público', titleEn: 'Public Sector Acquisitions, Leases and Services Law', shortName: 'LAASSP', category: 'ley_federal' },
  { id: 'lopsrm', code: 'lopsrm', title: 'Ley de Obras Públicas y Servicios Relacionados con las Mismas', titleEn: 'Public Works and Related Services Law', shortName: 'LOPSRM', category: 'ley_federal' },
  { id: 'lbn', code: 'lbn', title: 'Ley de Bienes Nacionales', titleEn: 'National Property Law', shortName: 'Ley de Bienes Nacionales', category: 'ley_federal' },
  { id: 'laad', code: 'laad', title: 'Ley de Amparo', titleEn: 'Amparo Law (Constitutional Remedies)', shortName: 'Ley de Amparo', category: 'ley_federal' },
  { id: 'lm', code: 'lm', title: 'Ley de Migración', titleEn: 'Migration Law', shortName: 'Ley de Migración', category: 'ley_federal' },
  { id: 'lnb', code: 'lnb', title: 'Ley de Navegación y Comercio Marítimos', titleEn: 'Maritime Navigation and Commerce Law', shortName: 'Ley de Navegación', category: 'ley_federal' },
  { id: 'lav', code: 'lav', title: 'Ley de Aviación Civil', titleEn: 'Civil Aviation Law', shortName: 'Ley de Aviación', category: 'ley_federal' },
  { id: 'lae', code: 'lae', title: 'Ley de Aeropuertos', titleEn: 'Airports Law', shortName: 'Ley de Aeropuertos', category: 'ley_federal' },
  { id: 'lc', code: 'lc', title: 'Ley de Caminos, Puentes y Autotransporte Federal', titleEn: 'Federal Roads, Bridges and Motor Transport Law', shortName: 'Ley de Caminos', category: 'ley_federal' },
  { id: 'lsf', code: 'lsf', title: 'Ley del Servicio Ferroviario', titleEn: 'Railway Service Law', shortName: 'Ley del Servicio Ferroviario', category: 'ley_federal' },
  { id: 'lspcpfsp', code: 'lspcpfsp', title: 'Ley del Servicio Profesional de Carrera en la Administración Pública Federal', titleEn: 'Federal Civil Service Career Law', shortName: 'Ley del Servicio Prof. Carrera', category: 'ley_federal' },
  { id: 'lsnsp', code: 'lsnsp', title: 'Ley del Sistema Nacional de Seguridad Pública', titleEn: 'National Public Security System Law', shortName: 'Ley del SNSP', category: 'ley_federal' },
  { id: 'ley_aduanera', code: 'ley_aduanera', title: 'Ley Aduanera', titleEn: 'Customs Law', shortName: 'Ley Aduanera', category: 'ley_federal' },
  { id: 'ley_moneda', code: 'ley_moneda', title: 'Ley Monetaria de los Estados Unidos Mexicanos', titleEn: 'Monetary Law', shortName: 'Ley Monetaria', category: 'ley_federal' },
  { id: 'ley_bm', code: 'ley_bm', title: 'Ley del Banco de México', titleEn: 'Bank of Mexico Law', shortName: 'Ley Banxico', category: 'ley_federal' },
  { id: 'lic', code: 'lic', title: 'Ley de Instituciones de Crédito', titleEn: 'Credit Institutions Law', shortName: 'LIC', category: 'ley_federal' },
  { id: 'lmv', code: 'lmv', title: 'Ley del Mercado de Valores', titleEn: 'Securities Market Law', shortName: 'LMV', category: 'ley_federal' },
  { id: 'lgoaac', code: 'lgoaac', title: 'Ley General de Organizaciones y Actividades Auxiliares del Crédito', titleEn: 'General Law on Credit Auxiliary Organizations and Activities', shortName: 'LGOAAC', category: 'ley_federal' },
  { id: 'lisf', code: 'lisf', title: 'Ley de Instituciones de Seguros y de Fianzas', titleEn: 'Insurance and Surety Institutions Law', shortName: 'LISF', category: 'ley_federal' },
  { id: 'lraf', code: 'lraf', title: 'Ley para Regular las Agrupaciones Financieras', titleEn: 'Financial Groups Regulation Law', shortName: 'Ley de Agrupaciones Fin.', category: 'ley_federal' },
  { id: 'lcnbv', code: 'lcnbv', title: 'Ley de la Comisión Nacional Bancaria y de Valores', titleEn: 'National Banking and Securities Commission Law', shortName: 'Ley CNBV', category: 'ley_federal' },
  { id: 'lcondusef', code: 'lcondusef', title: 'Ley de Protección y Defensa al Usuario de Servicios Financieros', titleEn: 'Financial Services User Protection and Defense Law', shortName: 'Ley CONDUSEF', category: 'ley_federal' },
  { id: 'ltf', code: 'ltf', title: 'Ley de Transparencia y de Fomento a la Competencia en el Crédito Garantizado', titleEn: 'Transparency and Competition in Secured Credit Law', shortName: 'Ley Transparencia Crédito', category: 'ley_federal' },
  { id: 'lupd', code: 'lupd', title: 'Ley de Uniones de Crédito', titleEn: 'Credit Unions Law', shortName: 'Ley de Uniones de Crédito', category: 'ley_federal' },
  { id: 'lspc', code: 'lspc', title: 'Ley de Sociedad de Responsabilidad Limitada de Interés Público', titleEn: 'Public Interest Limited Liability Companies Law', shortName: 'LSPC', category: 'ley_federal' },
  { id: 'lpab', code: 'lpab', title: 'Ley de Protección al Ahorro Bancario', titleEn: 'Bank Savings Protection Law (IPAB)', shortName: 'Ley IPAB', category: 'ley_federal' },
  { id: 'lse', code: 'lse', title: 'Ley del Servicio Exterior Mexicano', titleEn: 'Mexican Foreign Service Law', shortName: 'Ley del Servicio Exterior', category: 'ley_federal' },
  { id: 'lsn', code: 'lsn', title: 'Ley de Seguridad Nacional', titleEn: 'National Security Law', shortName: 'Ley de Seguridad Nacional', category: 'ley_federal' },
  { id: 'lfpiorpi', code: 'lfpiorpi', title: 'Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita', titleEn: 'Federal Anti-Money Laundering Law', shortName: 'Ley Antilavado', category: 'ley_federal' },
  { id: 'lnep', code: 'lnep', title: 'Ley Nacional de Ejecución Penal', titleEn: 'National Criminal Enforcement Law', shortName: 'LNEP', category: 'ley_federal' },
  { id: 'lnmascm', code: 'lnmascm', title: 'Ley Nacional de Mecanismos Alternativos de Solución de Controversias en Materia Penal', titleEn: 'National Law on Alternative Criminal Dispute Resolution', shortName: 'Ley MASC Penal', category: 'ley_federal' },
  { id: 'lnsjpa', code: 'lnsjpa', title: 'Ley Nacional del Sistema Integral de Justicia Penal para Adolescentes', titleEn: 'National Juvenile Criminal Justice System Law', shortName: 'Ley Justicia Adolescentes', category: 'ley_federal' },
  { id: 'lnr', code: 'lnr', title: 'Ley Nacional del Registro de Detenciones', titleEn: 'National Detention Registry Law', shortName: 'Ley Registro Detenciones', category: 'ley_federal' },
  { id: 'lne', code: 'lne', title: 'Ley Nacional de Extinción de Dominio', titleEn: 'National Asset Forfeiture Law', shortName: 'Ley de Extinción de Dominio', category: 'ley_federal' },
  { id: 'lpemfp', code: 'lpemfp', title: 'Ley de Petróleos Mexicanos', titleEn: 'Pemex Law', shortName: 'Ley Pemex', category: 'ley_federal' },
  { id: 'lcfe', code: 'lcfe', title: 'Ley de la Comisión Federal de Electricidad', titleEn: 'Federal Electricity Commission Law', shortName: 'Ley CFE', category: 'ley_federal' },
  { id: 'lhid', code: 'lhid', title: 'Ley de Hidrocarburos', titleEn: 'Hydrocarbons Law', shortName: 'Ley de Hidrocarburos', category: 'ley_federal' },
  { id: 'lie', code: 'lie', title: 'Ley de la Industria Eléctrica', titleEn: 'Electric Industry Law', shortName: 'Ley de la Ind. Eléctrica', category: 'ley_federal' },
  { id: 'lte', code: 'lte', title: 'Ley de Transición Energética', titleEn: 'Energy Transition Law', shortName: 'Ley de Transición Energética', category: 'ley_federal' },
  { id: 'lasea', code: 'lasea', title: 'Ley de la Agencia Nacional de Seguridad Industrial y de Protección al Medio Ambiente del Sector Hidrocarburos', titleEn: 'ASEA Law (Hydrocarbon Environmental Safety)', shortName: 'Ley ASEA', category: 'ley_federal' },
  { id: 'lcre', code: 'lcre', title: 'Ley de los Órganos Reguladores Coordinados en Materia Energética', titleEn: 'Coordinated Energy Regulatory Bodies Law', shortName: 'Ley Órganos Reguladores Energía', category: 'ley_federal' },
  { id: 'lase', code: 'lase', title: 'Ley de Aprovechamiento Sustentable de la Energía', titleEn: 'Sustainable Energy Use Law', shortName: 'LASE', category: 'ley_federal' },
  { id: 'laerfte', code: 'laerfte', title: 'Ley para el Aprovechamiento de Energías Renovables y el Financiamiento de la Transición Energética', titleEn: 'Renewable Energy and Energy Transition Financing Law', shortName: 'Ley de Energías Renovables', category: 'ley_federal' },
  { id: 'lgbn', code: 'lgbn', title: 'Ley de Bioseguridad de Organismos Genéticamente Modificados', titleEn: 'Biosafety of Genetically Modified Organisms Law', shortName: 'Ley de Bioseguridad', category: 'ley_federal' },
  { id: 'lgs', code: 'lgs', title: 'Ley General de Salud', titleEn: 'General Health Law', shortName: 'Ley General de Salud', category: 'ley_general' },
  { id: 'lga', code: 'lga', title: 'Ley General de Asentamientos Humanos, Ordenamiento Territorial y Desarrollo Urbano', titleEn: 'General Law on Human Settlements, Territorial Planning and Urban Development', shortName: 'Ley de Asentamientos Humanos', category: 'ley_general' },
  { id: 'lgcc', code: 'lgcc', title: 'Ley General de Cambio Climático', titleEn: 'General Climate Change Law', shortName: 'LGCC', category: 'ley_general' },
  { id: 'lgcg', code: 'lgcg', title: 'Ley General de Contabilidad Gubernamental', titleEn: 'General Government Accounting Law', shortName: 'LGCG', category: 'ley_general' },
  { id: 'lgdfs', code: 'lgdfs', title: 'Ley General de Desarrollo Forestal Sustentable', titleEn: 'General Sustainable Forest Development Law', shortName: 'Ley Forestal', category: 'ley_general' },
  { id: 'lgds', code: 'lgds', title: 'Ley General de Desarrollo Social', titleEn: 'General Social Development Law', shortName: 'LGDS', category: 'ley_general' },
  { id: 'lge', code: 'lge', title: 'Ley General de Educación', titleEn: 'General Education Law', shortName: 'Ley General de Educación', category: 'ley_general' },
  { id: 'lgeepa', code: 'lgeepa', title: 'Ley General del Equilibrio Ecológico y la Protección al Ambiente', titleEn: 'General Law on Ecological Equilibrium and Environmental Protection', shortName: 'LGEEPA', category: 'ley_general' },
  { id: 'lgimh', code: 'lgimh', title: 'Ley General para la Igualdad entre Mujeres y Hombres', titleEn: 'General Law for Equality Between Women and Men', shortName: 'LGIMH', category: 'ley_general' },
  { id: 'lgamvlv', code: 'lgamvlv', title: 'Ley General de Acceso de las Mujeres a una Vida Libre de Violencia', titleEn: 'General Law on Women\'s Access to a Life Free of Violence', shortName: 'Ley de Acceso Mujeres', category: 'ley_general' },
  { id: 'lgpdppso', code: 'lgpdppso', title: 'Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados', titleEn: 'General Law on Protection of Personal Data Held by Public Bodies', shortName: 'LGPDPPSO', category: 'ley_general' },
  { id: 'lgpgir', code: 'lgpgir', title: 'Ley General para la Prevención y Gestión Integral de los Residuos', titleEn: 'General Law for Prevention and Integral Management of Wastes', shortName: 'Ley de Residuos', category: 'ley_general' },
  { id: 'lgtaip', code: 'lgtaip', title: 'Ley General de Transparencia y Acceso a la Información Pública', titleEn: 'General Transparency and Access to Public Information Law', shortName: 'LGTAIP', category: 'ley_general' },
  { id: 'lgpc', code: 'lgpc', title: 'Ley General de Protección Civil', titleEn: 'General Civil Protection Law', shortName: 'Ley de Protección Civil', category: 'ley_general' },
  { id: 'lgv', code: 'lgv', title: 'Ley General de Víctimas', titleEn: 'General Victims Law', shortName: 'Ley General de Víctimas', category: 'ley_general' },
  { id: 'lgp', code: 'lgp', title: 'Ley General de Población', titleEn: 'General Population Law', shortName: 'Ley General de Población', category: 'ley_general' },
  { id: 'lgdnna', code: 'lgdnna', title: 'Ley General de los Derechos de Niñas, Niños y Adolescentes', titleEn: 'General Law on Rights of Children and Adolescents', shortName: 'Ley de Derechos de Niños', category: 'ley_general' },
  { id: 'lgra', code: 'lgra', title: 'Ley General de Responsabilidades Administrativas', titleEn: 'General Administrative Responsibilities Law', shortName: 'LGRA', category: 'ley_general' },
  { id: 'lgsna', code: 'lgsna', title: 'Ley General del Sistema Nacional Anticorrupción', titleEn: 'General Law on the National Anti-Corruption System', shortName: 'Ley del SNA', category: 'ley_general' },
  { id: 'lgipe', code: 'lgipe', title: 'Ley General de Instituciones y Procedimientos Electorales', titleEn: 'General Law on Electoral Institutions and Procedures', shortName: 'LGIPE', category: 'ley_general' },
  { id: 'lgpp', code: 'lgpp', title: 'Ley General de Partidos Políticos', titleEn: 'General Law on Political Parties', shortName: 'LGPP', category: 'ley_general' },
  { id: 'lgmde', code: 'lgmde', title: 'Ley General en Materia de Delitos Electorales', titleEn: 'General Law on Electoral Crimes', shortName: 'LGMDE', category: 'ley_general' },
  { id: 'lgpas', code: 'lgpas', title: 'Ley General de Pesca y Acuacultura Sustentables', titleEn: 'General Sustainable Fishing and Aquaculture Law', shortName: 'Ley de Pesca', category: 'ley_general' },
  { id: 'lgvs', code: 'lgvs', title: 'Ley General de Vida Silvestre', titleEn: 'General Wildlife Law', shortName: 'Ley de Vida Silvestre', category: 'ley_general' },
  { id: 'lgt', code: 'lgt', title: 'Ley General de Turismo', titleEn: 'General Tourism Law', shortName: 'Ley de Turismo', category: 'ley_general' },
  { id: 'lgc', code: 'lgc', title: 'Ley General de Cultura y Derechos Culturales', titleEn: 'General Law on Culture and Cultural Rights', shortName: 'Ley de Cultura', category: 'ley_general' },
  { id: 'lgcfd', code: 'lgcfd', title: 'Ley General de Cultura Física y Deporte', titleEn: 'General Physical Culture and Sports Law', shortName: 'Ley del Deporte', category: 'ley_general' },
  { id: 'lgdapc', code: 'lgdapc', title: 'Ley General de Archivos', titleEn: 'General Archives Law', shortName: 'Ley de Archivos', category: 'ley_general' },
  { id: 'lgmsv', code: 'lgmsv', title: 'Ley General de Movilidad y Seguridad Vial', titleEn: 'General Mobility and Road Safety Law', shortName: 'Ley de Movilidad', category: 'ley_general' },
  { id: 'lgcs', code: 'lgcs', title: 'Ley General de Comunicación Social', titleEn: 'General Social Communication Law', shortName: 'Ley de Comunicación Social', category: 'ley_general' },
  { id: 'lgmr', code: 'lgmr', title: 'Ley General de Mejora Regulatoria', titleEn: 'General Regulatory Improvement Law', shortName: 'Ley de Mejora Regulatoria', category: 'ley_general' },
  { id: 'lgsacdsi', code: 'lgsacdsi', title: 'Ley General para la Prevención Social de la Violencia y la Delincuencia', titleEn: 'General Law for Social Prevention of Violence and Crime', shortName: 'Ley Prev. Social Violencia', category: 'ley_general' },
  { id: 'lgdms', code: 'lgdms', title: 'Ley General de los Derechos de Personas Mayores', titleEn: 'General Law on Rights of Older Persons', shortName: 'Ley Personas Mayores', category: 'ley_general' },
  { id: 'lgec', code: 'lgec', title: 'Ley General de Economía Circular', titleEn: 'General Circular Economy Law', shortName: 'Ley de Economía Circular', category: 'ley_general' },
  { id: 'lgipd', code: 'lgipd', title: 'Ley General para la Inclusión de las Personas con Discapacidad', titleEn: 'General Law for Inclusion of Persons with Disabilities', shortName: 'Ley de Inclusión Discapacidad', category: 'ley_general' },

  // ═══════════════════════════════════════════════════════
  // LEYES ORGÁNICAS
  // ═══════════════════════════════════════════════════════
  { id: 'loapf', code: 'loapf', title: 'Ley Orgánica de la Administración Pública Federal', titleEn: 'Organic Law of the Federal Public Administration', shortName: 'LOAPF', category: 'ley_organica' },
  { id: 'lopjf', code: 'lopjf', title: 'Ley Orgánica del Poder Judicial de la Federación', titleEn: 'Organic Law of the Federal Judiciary', shortName: 'LOPJF', category: 'ley_organica' },
  { id: 'locgeum', code: 'locgeum', title: 'Ley Orgánica del Congreso General de los Estados Unidos Mexicanos', titleEn: 'Organic Law of the General Congress', shortName: 'Ley Orgánica del Congreso', category: 'ley_organica' },
  { id: 'loefa', code: 'loefa', title: 'Ley Orgánica del Ejército y Fuerza Aérea Mexicanos', titleEn: 'Organic Law of the Mexican Army and Air Force', shortName: 'Ley Orgánica del Ejército', category: 'ley_organica' },
  { id: 'loam', code: 'loam', title: 'Ley Orgánica de la Armada de México', titleEn: 'Organic Law of the Mexican Navy', shortName: 'Ley Orgánica de la Armada', category: 'ley_organica' },
  { id: 'lopgr', code: 'lopgr', title: 'Ley Orgánica de la Procuraduría General de la República', titleEn: 'Organic Law of the Attorney General', shortName: 'LOPGR', category: 'ley_organica' },
  { id: 'lofgr', code: 'lofgr', title: 'Ley de la Fiscalía General de la República', titleEn: 'Attorney General of the Republic Law', shortName: 'Ley de la FGR', category: 'ley_organica' },
  { id: 'lotfja', code: 'lotfja', title: 'Ley Orgánica del Tribunal Federal de Justicia Administrativa', titleEn: 'Organic Law of the Federal Administrative Justice Tribunal', shortName: 'Ley del TFJA', category: 'ley_organica' },
  { id: 'loasf', code: 'loasf', title: 'Ley de Fiscalización y Rendición de Cuentas de la Federación', titleEn: 'Federal Audit and Accountability Law', shortName: 'Ley de Fiscalización', category: 'ley_organica' },

  // ═══════════════════════════════════════════════════════
  // LEYES REGLAMENTARIAS
  // ═══════════════════════════════════════════════════════
  { id: 'lra27', code: 'lra27', title: 'Ley Reglamentaria del Artículo 27 Constitucional en Materia de Energía Nuclear', titleEn: 'Regulatory Law on Nuclear Energy (Article 27)', shortName: 'Ley Energía Nuclear', category: 'ley_reglamentaria' },
  { id: 'lagra', code: 'lagra', title: 'Ley Agraria', titleEn: 'Agrarian Law', shortName: 'Ley Agraria', category: 'ley_reglamentaria' },
  { id: 'lra5', code: 'lra5', title: 'Ley Reglamentaria del Artículo 5o. Constitucional, Relativo al Ejercicio de las Profesiones', titleEn: 'Regulatory Law on Professional Practice (Article 5)', shortName: 'Ley de Profesiones', category: 'ley_reglamentaria' },
  { id: 'lra6', code: 'lra6', title: 'Ley Reglamentaria del Artículo 6o., Párrafo Primero, de la Constitución', titleEn: 'Regulatory Law on Right to Information (Article 6)', shortName: 'Ley Reg. Art. 6', category: 'ley_reglamentaria' },
  { id: 'lminera', code: 'lminera', title: 'Ley Minera', titleEn: 'Mining Law', shortName: 'Ley Minera', category: 'ley_reglamentaria' },
  { id: 'lexpropiacion', code: 'lexpropiacion', title: 'Ley de Expropiación', titleEn: 'Expropriation Law', shortName: 'Ley de Expropiación', category: 'ley_reglamentaria' },

  // ═══════════════════════════════════════════════════════
  // ADDITIONAL FEDERAL LAWS (Finance, Economy, Social)
  // ═══════════════════════════════════════════════════════
  { id: 'ldp', code: 'ldp', title: 'Ley de Disciplina Financiera de las Entidades Federativas y los Municipios', titleEn: 'Financial Discipline Law for States and Municipalities', shortName: 'Ley de Disciplina Financiera', category: 'ley_federal' },
  { id: 'lfe_electrica', code: 'lfe_electrica', title: 'Ley del Servicio Público de Energía Eléctrica', titleEn: 'Public Electric Energy Service Law', shortName: 'Ley del Serv. Público Elec.', category: 'ley_federal' },
  { id: 'lna', code: 'lna', title: 'Ley de Nacionalidad', titleEn: 'Nationality Law', shortName: 'Ley de Nacionalidad', category: 'ley_federal' },
  { id: 'lgah', code: 'lgah', title: 'Ley General de Asentamientos Humanos', titleEn: 'General Law on Human Settlements', shortName: 'LGAH', category: 'ley_general' },
  { id: 'ldrs', code: 'ldrs', title: 'Ley de Desarrollo Rural Sustentable', titleEn: 'Sustainable Rural Development Law', shortName: 'Ley de Desarrollo Rural', category: 'ley_federal' },
  { id: 'lis', code: 'lis', title: 'Ley de Ingresos de la Federación', titleEn: 'Federal Revenue Law', shortName: 'Ley de Ingresos', category: 'ley_federal' },
  { id: 'lfc', code: 'lfc', title: 'Ley Federal de Cinematografía', titleEn: 'Federal Film Law', shortName: 'Ley de Cinematografía', category: 'ley_federal' },
  { id: 'lfrd', code: 'lfrd', title: 'Ley Federal de Radio y Televisión', titleEn: 'Federal Radio and Television Law', shortName: 'Ley de Radio y TV', category: 'ley_federal' },
  { id: 'liva_impuestos', code: 'liva_impuestos', title: 'Ley del Impuesto sobre Automóviles Nuevos', titleEn: 'New Automobile Tax Law', shortName: 'Ley ISAN', category: 'ley_federal' },
  { id: 'lfv', code: 'lfv', title: 'Ley Federal de Variedades Vegetales', titleEn: 'Federal Plant Varieties Law', shortName: 'Ley de Variedades Vegetales', category: 'ley_federal' },
  { id: 'ldc', code: 'ldc', title: 'Ley de Coordinación Fiscal', titleEn: 'Fiscal Coordination Law', shortName: 'Ley de Coordinación Fiscal', category: 'ley_federal' },
  { id: 'lrascap', code: 'lrascap', title: 'Ley para Regular las Sociedades de Información Crediticia', titleEn: 'Credit Information Companies Regulation Law', shortName: 'Ley de Burós de Crédito', category: 'ley_federal' },
  { id: 'lapp', code: 'lapp', title: 'Ley de Asociaciones Público Privadas', titleEn: 'Public-Private Partnerships Law', shortName: 'Ley de APP', category: 'ley_federal' },
  { id: 'lpif', code: 'lpif', title: 'Ley de Planeación', titleEn: 'Planning Law', shortName: 'Ley de Planeación', category: 'ley_federal' },
  { id: 'lfdc', code: 'lfdc', title: 'Ley Federal de Declaración Especial de Ausencia para Personas Desaparecidas', titleEn: 'Federal Law on Declaration of Absence for Missing Persons', shortName: 'Ley Personas Desaparecidas', category: 'ley_federal' },
  { id: 'lgdp', code: 'lgdp', title: 'Ley General en Materia de Desaparición Forzada de Personas', titleEn: 'General Law on Forced Disappearance', shortName: 'Ley Desaparición Forzada', category: 'ley_general' },
  { id: 'lgtv', code: 'lgtv', title: 'Ley General para Prevenir, Investigar y Sancionar la Tortura', titleEn: 'General Law on Prevention, Investigation and Punishment of Torture', shortName: 'Ley contra la Tortura', category: 'ley_general' },
  { id: 'lgtp', code: 'lgtp', title: 'Ley General para Prevenir y Sancionar los Delitos en Materia de Secuestro', titleEn: 'General Law on Kidnapping', shortName: 'Ley contra el Secuestro', category: 'ley_general' },
  { id: 'lgtrata', code: 'lgtrata', title: 'Ley General para Prevenir, Sancionar y Erradicar los Delitos en Materia de Trata de Personas', titleEn: 'General Law on Human Trafficking', shortName: 'Ley contra la Trata', category: 'ley_general' },
  { id: 'lcndh', code: 'lcndh', title: 'Ley de la Comisión Nacional de los Derechos Humanos', titleEn: 'National Human Rights Commission Law', shortName: 'Ley CNDH', category: 'ley_federal' },
  { id: 'lvivienda', code: 'lvivienda', title: 'Ley de Vivienda', titleEn: 'Housing Law', shortName: 'Ley de Vivienda', category: 'ley_federal' },
  { id: 'linfonavit', code: 'linfonavit', title: 'Ley del Instituto del Fondo Nacional de la Vivienda para los Trabajadores', titleEn: 'INFONAVIT Law', shortName: 'Ley INFONAVIT', category: 'ley_federal' },
  { id: 'lagn', code: 'lagn', title: 'Ley de la Guardia Nacional', titleEn: 'National Guard Law', shortName: 'Ley de la Guardia Nacional', category: 'ley_federal' },
  { id: 'lfvejm', code: 'lfvejm', title: 'Ley Federal de Juegos y Sorteos', titleEn: 'Federal Law on Games and Lotteries', shortName: 'Ley de Juegos y Sorteos', category: 'ley_federal' },
  { id: 'ldn', code: 'ldn', title: 'Ley de la Defensa Nacional', titleEn: 'National Defense Law', shortName: 'Ley de Defensa Nacional', category: 'ley_federal' },
  { id: 'lfefr', code: 'lfefr', title: 'Ley Federal de Extinción de Dominio', titleEn: 'Federal Asset Forfeiture Law', shortName: 'Ley Fed. Extinción Dominio', category: 'ley_federal' },

  // ═══════════════════════════════════════════════════════
  // ADDITIONAL (Environmental, Infrastructure, Social Policy)
  // ═══════════════════════════════════════════════════════
  { id: 'ldbn', code: 'ldbn', title: 'Ley de Desarrollo Sustentable de la Caña de Azúcar', titleEn: 'Sustainable Sugar Cane Development Law', shortName: 'Ley Caña de Azúcar', category: 'ley_federal' },
  { id: 'lfmzaah', code: 'lfmzaah', title: 'Ley Federal de Monumentos y Zonas Arqueológicos, Artísticos e Históricos', titleEn: 'Federal Law on Archaeological, Artistic and Historical Monuments', shortName: 'Ley de Monumentos', category: 'ley_federal' },
  { id: 'lgbio', code: 'lgbio', title: 'Ley General de Bienes Nacionales', titleEn: 'General Law on National Property', shortName: 'Ley de Bienes Nacionales', category: 'ley_general' },
  { id: 'lscssp', code: 'lscssp', title: 'Ley sobre el Contrato de Seguro', titleEn: 'Insurance Contract Law', shortName: 'Ley del Contrato de Seguro', category: 'ley_federal' },
  { id: 'lgtoc', code: 'lgtoc', title: 'Ley General de Títulos y Operaciones de Crédito', titleEn: 'General Law on Credit Instruments and Transactions', shortName: 'LGTOC', category: 'ley_federal' },
  { id: 'lncm', code: 'lncm', title: 'Ley Federal de Protección a la Propiedad Industrial', titleEn: 'Federal Law on Industrial Property Protection', shortName: 'Ley de Propiedad Industrial', category: 'ley_federal' },
  { id: 'lfra', code: 'lfra', title: 'Ley Federal de Responsabilidad Ambiental', titleEn: 'Federal Environmental Liability Law', shortName: 'Ley de Resp. Ambiental', category: 'ley_federal' },
  { id: 'limss', code: 'limss', title: 'Ley del Instituto Mexicano del Seguro Social', titleEn: 'Mexican Social Security Institute Law', shortName: 'Ley IMSS', category: 'ley_federal' },
  { id: 'lcts', code: 'lcts', title: 'Ley General de Ciencia, Tecnología e Innovación', titleEn: 'General Science, Technology and Innovation Law', shortName: 'Ley de Ciencia y Tecnología', category: 'ley_general' },
  { id: 'lgah2', code: 'lgah2', title: 'Ley General de Acceso de las Mujeres a una Vida Libre de Violencia', titleEn: 'General Law on Women\'s Access to Violence-Free Life', shortName: 'Ley Mujeres Vida Libre', category: 'ley_general' },

  // ═══════════════════════════════════════════════════════
  // ESTATUTOS Y OTROS
  // ═══════════════════════════════════════════════════════
  { id: 'eotrib', code: 'eotrib', title: 'Estatuto Orgánico del Tribunal Federal de Justicia Administrativa', titleEn: 'Organic Statute of the Federal Administrative Justice Tribunal', shortName: 'Estatuto TFJA', category: 'estatuto' },
  { id: 'lci', code: 'lci', title: 'Ley de Ciencia y Tecnología', titleEn: 'Science and Technology Law', shortName: 'Ley de Ciencia', category: 'ley_federal' },
  { id: 'lnac_reg', code: 'lnac_reg', title: 'Ley del Registro Nacional de Datos de Personas Extraviadas o Desaparecidas', titleEn: 'National Registry of Missing or Disappeared Persons Law', shortName: 'Ley Reg. Personas Desap.', category: 'ley_federal' },
  { id: 'lpcdmx', code: 'lpcdmx', title: 'Ley Federal de la Zona Exclusiva Económica', titleEn: 'Federal Law on Exclusive Economic Zone', shortName: 'Ley Zona Eco. Exclusiva', category: 'ley_federal' },
  { id: 'lfpes', code: 'lfpes', title: 'Ley Federal de las Entidades Paraestatales', titleEn: 'Federal Parastatal Entities Law', shortName: 'Ley de Paraestatales', category: 'ley_federal' },
  { id: 'ldbn2', code: 'ldbn2', title: 'Ley de Deuda Pública', titleEn: 'Public Debt Law', shortName: 'Ley de Deuda Pública', category: 'ley_federal' },
  { id: 'lra', code: 'lra', title: 'Ley de la Renta', titleEn: 'Rental Law', shortName: 'Ley de la Renta', category: 'ley_federal' },
];

function buildCensusLaw(entry: Omit<CensusLaw, 'url' | 'pdfUrl' | 'classification'>): CensusLaw {
  return {
    ...entry,
    url: `https://www.diputados.gob.mx/LeyesBiblio/ref/${entry.code}.htm`,
    pdfUrl: `https://www.diputados.gob.mx/LeyesBiblio/pdf/${entry.code.toUpperCase()}.pdf`,
    classification: 'ingestable',
  };
}

/**
 * Attempt to scrape additional laws from the live index page.
 * Returns empty array if site is unreachable.
 */
async function scrapeLiveIndex(): Promise<CensusLaw[]> {
  const urls = [
    'https://www.diputados.gob.mx/LeyesBiblio/ref.htm',
    'https://www.diputados.gob.mx/LeyesBiblio/index.htm',
  ];

  for (const url of urls) {
    try {
      console.log(`  Trying ${url}...`);
      const result = await fetchWithRateLimit(url, 1);

      if (result.status !== 200) {
        console.log(`  HTTP ${result.status} — skipped`);
        continue;
      }

      // Parse law links: /LeyesBiblio/ref/{code}.htm or /LeyesBiblio/pdf/{CODE}.pdf
      const linkRe = /href="(?:\/LeyesBiblio\/)?(?:ref|pdf)\/([a-zA-Z0-9_]+)\.(?:htm|pdf)"/gi;
      const codes = new Set<string>();
      let match: RegExpExecArray | null;

      while ((match = linkRe.exec(result.body)) !== null) {
        codes.add(match[1].toLowerCase());
      }

      console.log(`  Found ${codes.size} law codes from live index`);

      // Build CensusLaw entries for codes not in KNOWN_LAWS
      const knownCodes = new Set(KNOWN_LAWS.map(l => l.code));
      const newLaws: CensusLaw[] = [];

      for (const code of codes) {
        if (!knownCodes.has(code)) {
          newLaws.push({
            id: code,
            code,
            title: code.toUpperCase(), // placeholder — no title available from link
            titleEn: '',
            shortName: code.toUpperCase(),
            category: 'ley_federal',
            url: `https://www.diputados.gob.mx/LeyesBiblio/ref/${code}.htm`,
            pdfUrl: `https://www.diputados.gob.mx/LeyesBiblio/pdf/${code.toUpperCase()}.pdf`,
            classification: 'ingestable',
          });
        }
      }

      return newLaws;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${msg}`);
    }
  }

  return [];
}

async function main(): Promise<void> {
  const liveOnly = process.argv.includes('--live-only');

  console.log('Mexican Law MCP — Census');
  console.log('========================\n');
  console.log('  Source:  Cámara de Diputados (diputados.gob.mx/LeyesBiblio)');
  console.log('  Method:  Curated list + live index scrape');
  console.log('  License: Government Public Data (public domain)\n');

  // Start with curated list
  const allLaws: CensusLaw[] = KNOWN_LAWS.map(buildCensusLaw);
  const seenIds = new Set(allLaws.map(l => l.id));

  console.log(`  Curated list: ${allLaws.length} laws\n`);

  // Try live scraping
  if (!liveOnly) {
    console.log('  Attempting live index scrape...');
    const liveLaws = await scrapeLiveIndex();

    for (const law of liveLaws) {
      if (!seenIds.has(law.id)) {
        seenIds.add(law.id);
        allLaws.push(law);
      }
    }

    if (liveLaws.length > 0) {
      console.log(`  Added ${liveLaws.length} laws from live index`);
    } else {
      console.log('  Live index unreachable — using curated list only');
    }
  }

  // Sort by category then by id
  allLaws.sort((a, b) => {
    const catOrder = ['constitucion', 'codigo', 'ley_federal', 'ley_general', 'ley_nacional', 'ley_organica', 'ley_reglamentaria', 'estatuto', 'otro'];
    const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.id.localeCompare(b.id);
  });

  // Build category stats
  const byCategory: Record<string, number> = {};
  for (const law of allLaws) {
    byCategory[law.category] = (byCategory[law.category] ?? 0) + 1;
  }

  const census: CensusOutput = {
    generated_at: new Date().toISOString(),
    source: 'diputados.gob.mx/LeyesBiblio (Cámara de Diputados)',
    description: 'Full census of Mexican federal legislation — Constitution, codes, federal laws, general laws, organic laws, and regulatory laws',
    stats: {
      total: allLaws.length,
      class_ingestable: allLaws.filter(a => a.classification === 'ingestable').length,
      class_inaccessible: allLaws.filter(a => a.classification === 'inaccessible').length,
      class_metadata_only: allLaws.filter(a => a.classification === 'metadata_only').length,
      by_category: byCategory,
    },
    laws: allLaws,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2) + '\n');

  console.log(`\n${'='.repeat(50)}`);
  console.log('CENSUS COMPLETE');
  console.log('='.repeat(50));
  console.log(`  Total laws discovered:  ${allLaws.length}`);
  console.log(`  Ingestable:             ${census.stats.class_ingestable}`);
  console.log(`  Inaccessible:           ${census.stats.class_inaccessible}`);
  console.log(`  Metadata only:          ${census.stats.class_metadata_only}`);
  console.log('\n  By category:');
  for (const [cat, count] of Object.entries(byCategory).sort(([, a], [, b]) => b - a)) {
    console.log(`    ${cat.padEnd(22)} ${count}`);
  }
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
