/**
 * Years in business for deal-tape counterparties that company-master.json
 * doesn't cover (they only appear in the customs-derived tape rows).
 * Researched 2026-10-16. YIB = whole years from the start date to that day.
 *
 * Basis:
 *  - "registry": exact start or registration date from a company registry
 *    (Peru: SUNAT via datosperu.org; Spain/Germany/Italy/Portugal registries).
 *  - "published": founding year the company or trade press publishes.
 *  - "lower-bound": only an earliest proof of activity is public; real age is
 *    at least this.
 *  - "group": the founding year of the parent group, not the trading entity.
 *
 * Dimension A scores YIB as min(100, years × 10), so every company at 10+
 * years scores the same; lower bounds and group dates above 10 don't change
 * the score.
 *
 * Not found (left blank, deals stay blocked). Each was checked against the
 * Veritrade declaration for its legal name first:
 *  - NUEVA VISTA, G Y S MARKETING S DE RL DE CV (Hermosillo; Giumarra–Salazar
 *    joint venture, no founding date published), DALIAN NEL CASO TRADE CO.LTD
 *    (the combined "DALIAN … | FRESHIPS …" buyer): named as importer on
 *    their declarations, no public founding date.
 *  - JOY LEE CO LTD: exists (Taiwan 樂利蔬果國際有限公司, unified no. 94094509),
 *    founding date not public.
 *  - ALLIED TRADE INTERNATIONAL LINK CO LTD: not on any declaration in our
 *    Veritrade files (CUST-2026-133 is outside their coverage), not found online.
 *  - "Unknown buyer" rows: Veritrade itself hides the importer (Peru "N/A",
 *    Chile files have no importer column), so there is nothing to research.
 */
export interface CompanyYibResearch {
  years: number;
  since: string;
  basis: "registry" | "published" | "lower-bound" | "group";
  source: string;
}

export const TAPE_COMPANY_YIB: Record<string, CompanyYibResearch> = {
  // --- Suppliers (Peru, SUNAT "Fecha Inicio Actividades") ---
  "QORI FOODS S.A.C": {
    years: 11, since: "2014-11-04", basis: "registry",
    source: "https://www.datosperu.org/empresa-qori-foods-sac-20566127181.php",
  },
  "INKA PRODUCE S.A.C": {
    years: 3, since: "2023-01-29", basis: "registry",
    source: "https://www.datosperu.org/empresa-inka-produce-sac-20610526234.php",
  },
  "EXPORTADORA FRUTICOLA DEL SUR SA": {
    years: 38, since: "1988-05-03", basis: "registry",
    source: "https://www.datosperu.org/empresa-exportadora-fruticola-del-sur-sa-20104902864.php",
  },
  "CONSORCIO NEW DE LUZ E.I.R.L": {
    years: 4, since: "2021-11-01", basis: "registry",
    source: "https://www.datosperu.org/empresa-consorcio-new-de-luz-eirl-20608620312.php",
  },
  "LAND FOOD EXPORTS S.A.C": {
    years: 1, since: "2025-06-24", basis: "registry",
    source: "https://www.datosperu.org/empresa-land-food-exports-sac-20614245850.php",
  },
  "COOPERATIVA AGRARIA CAFETALERA LA PROSPERIDAD DE CHIRINOS": {
    years: 58, since: "1968-02-27", basis: "registry",
    source: "https://www.datosperu.org/empresa-cooperativa-agraria-cafetalera-la-prosperidad-de-chirinos-20147123052.php",
  },

  // --- Buyers ---
  "SHEEMIT AGRO FRESH": {
    years: 13, since: "2013", basis: "published",
    source: "https://www.tradeindia.com/sheemit-agro-fresh-28429619/ (Vadodara, India)",
  },
  "SUN 7 FRUITS": {
    years: 13, since: "2013-08-22", basis: "registry",
    source: "https://www.pappers.fr/entreprise/sun-7-fruits-794423566 (SIREN 794423566, Rungis)",
  },
  "ALL CITRUS S.R.L": {
    years: 24, since: "2002-02-26", basis: "registry",
    source: "https://www.ufficiocamerale.it/3801/agricola-lusia-srl (P.IVA 01197460296; renamed from Agricola Lusia 2024-05-07)",
  },
  "FRESHIPS INTERNATIONAL LLC": {
    years: 5, since: "2021", basis: "published",
    source: "https://www.dnb.com/business-directory/company-profiles.freships_international_llc.24665aa234143c31590b5cbedd1fbb79.html (Wilmington, DE)",
  },
  "FRUTAS ALHAMBRA S.L": {
    years: 29, since: "1996-12-02", basis: "registry",
    source: "https://www.einforma.com/informacion-empresa/frutas-alhambra",
  },
  "INGMAR HEUER GMBH": {
    years: 24, since: "2001-11-21", basis: "registry",
    source: "https://www.northdata.de/Ingmar+Heuer+GmbH,+Hamburg (HRB 80120)",
  },
  "AXARFRUIT SL": {
    years: 13, since: "2012-11-20", basis: "registry",
    source: "https://infonif.economia3.com/ficha-empresa/axarfruit-sl (CIF B93225811)",
  },
  "AGRICOLA GLORIA SRL": {
    years: 10, since: "2016-02-09", basis: "registry",
    source: "https://registroaziende.it/azienda/agricola-gloria-srl-milano (group trading since 1932)",
  },
  "SWEET FRUITS S.A": {
    years: 16, since: "2010-01-26", basis: "registry",
    source: "https://infotrustgo.pt/en/companies/sweet-fruits-sa (Mafra, Portugal; name match, entity not confirmed by tax ID)",
  },
  "NANAK PRODUCE & MARKETING INC": {
    years: 17, since: "2009", basis: "published",
    source: "https://www.producemarketguide.com/company/500516/nanak-produce-marketing-inc",
  },
  "CLASSIC HARVEST PRODUCE LLC": {
    years: 12, since: "2014-05", basis: "published",
    source: "https://www.producemarketguide.com/company/573745/classic-harvest-llc (listed as Classic Harvest LLC)",
  },
  "SUSTAINABLE HARVEST INC": {
    years: 29, since: "1997", basis: "published",
    source: "https://group.sucafina.com/network/sustainable-harvest",
  },
  "SWEET SEASONS LLC": {
    years: 18, since: "2008", basis: "published",
    source: "https://www.producemarketguide.com/company/195392/sweet-seasons-llc",
  },
  "ENERGY FOOD INGREDIENTS B.V": {
    years: 11, since: "2015", basis: "published",
    source: "https://nutrada.com/suppliers/energy-food-ingredients",
  },
  "SPREAFICO FRANCESCO & F.LLI S.P.A": {
    years: 63, since: "1963", basis: "published",
    source: "https://www.fruitnet.com/eurofruit/spreafico-founder-passes-away-aged-81/161842.article",
  },
  "INTERNATIONAL SPECIALTY PRODUCE INC": {
    years: 32, since: "1994", basis: "lower-bound",
    source: "https://www.producemarketguide.com/company/138068/international-specialty-produce-inc (PACA licence 19941368)",
  },
  "YOUNGSTOWN GRAPE DISTRIBUTORS INC": {
    years: 43, since: "1983-05-01", basis: "registry",
    source: "https://opengovus.com/sam-entity/KA77LFNKY8R9 (SAM UEI KA77LFNKY8R9, business start 1983-05-01; trademark filed 1950)",
  },
  "SOCIEDAD SUBSOLE COMERCIAL SA": {
    years: 25, since: "2001", basis: "lower-bound",
    source: "https://idbinvest.org/es/node/9406 (Subsole group financing project, 2001)",
  },
  "BIOTROPIC B.V": {
    years: 29, since: "1997", basis: "group",
    source: "https://www.freshplaza.com/article/2180036/20-years-of-biotropic-organic-for-one-world (BioTropic group, Duisburg)",
  },
  "CULTIPALTA S.L": {
    years: 6, since: "2019-11-05", basis: "registry",
    source: "https://infonif.economia3.com/ficha-empresa/cultipalta-sl (CIF B67532325, formerly Sigdal Trade S.L.; parent Grupo Cultivar founded 1986)",
  },
};
