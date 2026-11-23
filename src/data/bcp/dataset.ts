/**
 * Example portfolio for the BCP pre-harvest workspace (spec 2026-11-19, section 9).
 * Illustrative data, labelled as such on every screen: TruMarket has no
 * pre-harvest track record yet. All totals reconcile (see bcp.test.ts):
 * disbursed 66,600 of a 150,000 line, portfolio coverage 1.80x, provision 666,
 * use of funds 93% reconciled, 72% paid direct, 4,930 unexplained.
 */
import type { Application, Condition, ConditionState, Loan, Portfolio, Provenance, Tx } from "../../lib/bcp/types";
import { ensoAt, ninoAnomaly } from "./enso";

const L = (es: string, en: string): Tx => ({ es, en });
const ENGINE = "pre-harvest-v0.1";
const CUTOFF = "2026-11-10";

// Real readings: the coastal El Niño class (NOAA Niño 1+2, ENFEN classes) and export prices (customs).
const ENSO_SOURCE = L("ENFEN, comunicado 19-2026 · Niño 1+2 (NOAA) oct 2026", "ENFEN, communiqué 19-2026 · Niño 1+2 (NOAA) Oct 2026");
const PRICE_SOURCE = L("Exportaciones de palta Hass (aduanas) · ago 2026", "Hass avocado exports (customs) · Aug 2026");
const OCT_ANOM = ninoAnomaly("2026-10")!.toFixed(1);

// ---------------------------------------------------------------------------
// Conditions: one table per loan, grouped as in the spec (9.3).
// ---------------------------------------------------------------------------

type Row = [Condition["group"], Tx, Tx, Tx, Tx, ConditionState, Tx, Provenance, Tx];
const row = ([group, label, atApproval, today, threshold, state, effectOnRepayment, provenance, source]: Row): Condition => ({
  group,
  label,
  atApproval,
  today,
  threshold,
  state,
  effectOnRepayment,
  provenance,
  source,
});
const NONE = L("Ninguno", "None");

interface CondOpts {
  /** Approval date: the El Niño class known then. */
  approval: string;
  newDebt: [string, string, ConditionState, Tx];
  vigor: [string, string, ConditionState, Tx, string];
  water: [string, string];
  price: [string, string, Tx];
  exportable: [string, string, Tx];
  invoices: [Tx, Tx, ConditionState, Tx, string];
  work: [Tx, ConditionState, Tx];
  bureauDate: string;
}

function conditions(o: CondOpts): Condition[] {
  return [
    row(["Prestatario", L("Clasificación SBS", "SBS rating"), L("Normal", "Normal"), L("Normal", "Normal"), L("cualquier baja", "any downgrade"), "verde", NONE, "doc_verificado", L(`Central de riesgos · ${o.bureauDate}`, `Credit bureau · ${o.bureauDate}`)]),
    row(["Prestatario", L("Deuda nueva en el sistema", "New debt in the system"), L(o.newDebt[0], o.newDebt[0]), L(o.newDebt[1], o.newDebt[1]), L("+20% de la línea", "+20% of the line"), o.newDebt[2], o.newDebt[3], "doc_verificado", L(`Central de riesgos · ${o.bureauDate}`, `Credit bureau · ${o.bureauDate}`)]),
    row(["Prestatario", L("Deuda no declarada detectada", "Undeclared debt detected"), L("Ninguna", "None"), L("Ninguna", "None"), L("cualquiera congela el tramo", "any freezes the tranche"), "verde", NONE, "doc_verificado", L("Visita + proveedores de la zona · 08 nov", "Visit + local suppliers · 08 Nov")]),
    row(["Prestatario", L("Tenencia del predio y gravámenes", "Land tenure and liens"), L("Título propio · 0", "Own title · 0"), L("Título propio · 0", "Own title · 0"), L("cualquier gravamen nuevo", "any new lien"), "verde", NONE, "doc_verificado", L("SUNARP · 05 nov", "SUNARP · 05 Nov")]),
    row(["Prestatario", L("Licencia de agua", "Water licence"), L("Vigente", "Valid"), L("Vigente", "Valid"), L("vencida o suspendida", "expired or suspended"), "verde", NONE, "doc_verificado", L("ANA · 15 set", "ANA · 15 Sep")]),
    row(["Cultivo y volumen", L("Vigor del cultivo vs lo normal del lote", "Crop vigour vs the lot's normal"), L(o.vigor[0], o.vigor[0]), L(o.vigor[1], o.vigor[1]), L("-15% ámbar · -30% naranja", "-15% amber · -30% orange"), o.vigor[2], o.vigor[3], "satelital", L(`Sentinel-2 · ${o.vigor[4]}`, `Sentinel-2 · ${o.vigor[4]}`)]),
    row(["Cultivo y volumen", L("Agua disponible vs necesidad", "Water available vs need"), L(o.water[0], o.water[0]), L(o.water[1], o.water[1]), L("bajo 100%", "below 100%"), "verde", NONE, "satelital", L("ERA5 + licencia · 09 nov", "ERA5 + licence · 09 Nov")]),
    { ...row(["Cultivo y volumen", L("El Niño costero", "Coastal El Niño"), ensoAt(o.approval).label, ensoAt(CUTOFF).label, L("alerta temprana TM", "TM early warning"), "observacion", L("Volumen -5% a -10% · cobertura -0.10x a -0.20x", "Volume -5% to -10% · coverage -0.10x to -0.20x"), "estimado", ENSO_SOURCE]), real: true },
    row(["Cultivo y volumen", L("Seguro agrícola", "Crop insurance"), L("Vigente", "In force"), L("Vigente al 30 abr 2027", "In force to 30 Apr 2027"), L("vencido o sin pago", "expired or unpaid"), "verde", NONE, "doc_verificado", L("Póliza · 10 set", "Policy · 10 Sep")]),
    row(["Cultivo y volumen", L("Eventos de zona (paros, bloqueos)", "Zone events (strikes, blockades)"), L("Ninguno", "None"), L("Ninguno", "None"), L("evento que afecte un hito", "event affecting a milestone"), "verde", NONE, "declarado", L("Monitoreo de zona TM · 10 nov", "TM zone monitoring · 10 Nov")]),
    { ...row(["Precio y calidad", L("Precio esperado a cosecha", "Expected harvest price"), L(o.price[0], o.price[0]), L(o.price[1], o.price[1]), L("-15% ámbar · -30% naranja", "-15% amber · -30% orange"), "verde", o.price[2], "doc_verificado", PRICE_SOURCE]), real: true },
    row(["Precio y calidad", L("Fruta exportable", "Exportable fruit"), L(o.exportable[0], o.exportable[0]), L(o.exportable[1], o.exportable[1]), L("bajo 70%", "below 70%"), "verde", o.exportable[2], "estimado", L("Visita · 08 sep + sanidad", "Visit · 08 Sep + plant health")]),
    row(["Uso de fondos y cobranza", L("Facturas de tramos vs presupuesto", "Tranche invoices vs budget"), o.invoices[0], o.invoices[1], L("brecha 15% ámbar · 30% naranja", "gap 15% amber · 30% orange"), o.invoices[2], o.invoices[3], "doc_verificado", L(`Facturas electrónicas · ${o.invoices[4]}`, `E-invoices · ${o.invoices[4]}`)]),
    row(["Uso de fondos y cobranza", L("Labores en ventana", "Field work in window"), L("Plan de fase", "Phase plan"), o.work[0], L("+2 sem ámbar · +4 naranja", "+2 wk amber · +4 orange"), o.work[1], o.work[2], "satelital", L("Sentinel-2 + fotos · 08 nov", "Sentinel-2 + photos · 08 Nov")]),
    row(["Uso de fondos y cobranza", L("Cesión de cobros exclusiva", "Exclusive assignment of receivables"), L("Inscrita", "Registered"), L("Vigente, sin cesiones a terceros", "In force, no third-party assignments"), L("cualquier cesión a terceros", "any third-party assignment"), "verde", NONE, "doc_verificado", L("Registro de facturas negociables · 05 nov", "Negotiable invoice registry · 05 Nov")]),
    row(["Uso de fondos y cobranza", L("Cuenta de recaudo", "Collection account"), L("Abierta", "Open"), L("Abierta", "Open"), L("pago fuera de la cuenta = rojo", "payment outside the account = red"), "verde", NONE, "doc_verificado", L("Banco · 14 set", "Bank · 14 Sep")]),
    row(["Uso de fondos y cobranza", L("Contrato de packing", "Packhouse contract"), L("Firmado", "Signed"), L("Firmado", "Signed"), L("rescindido", "terminated"), "verde", NONE, "doc_verificado", L("Contrato · 10 set", "Contract · 10 Sep")]),
    row(["Uso de fondos y cobranza", L("Orden de compra del comprador", "Buyer's purchase order"), L("Prevista M3", "Expected at M3"), L("En plazo", "On time"), L("14 días tras M3", "14 days after M3"), "verde", NONE, "declarado", L("Hito M3 · 1 mar 2027", "M3 milestone · 1 Mar 2027")]),
  ];
}

const T1_CHECKLIST = [
  { label: L("Instrumentos firmados e inscritos", "Instruments signed and registered"), status: "ok" as const },
  { label: L("Cuenta de recaudo abierta", "Collection account open"), status: "ok" as const },
  { label: L("Cobertura de seguro verificada", "Insurance cover verified"), status: "ok" as const },
  { label: L("Vetos cerrados", "Vetoes closed"), status: "ok" as const },
];
const T3_PENDING = [
  { label: L("Cosecha verificada y apta", "Harvest verified and fit for export"), status: "pending" as const },
  { label: L("Packing contratado", "Packhouse contracted"), status: "pending" as const },
  { label: L("Comprador con cobertura activable", "Buyer with activatable credit cover"), status: "pending" as const },
];
const T2_DONE = (pctReconciled: number, bureau: string) => [
  { label: L(`Facturas de T1 conciliadas (${pctReconciled}%)`, `T1 invoices reconciled (${pctReconciled}%)`), status: "ok" as const },
  { label: L("Aforo independiente de cuajado", "Independent fruit-set yield estimate"), status: "ok" as const },
  { label: L(`Central de riesgos re-consultada ${bureau}`, `Credit bureau re-checked ${bureau}`), status: "ok" as const },
  { label: L("Labores en ventana", "Field work within window"), status: "ok" as const },
];

const weekly = (from: string, to: string, values: Array<[number, Tx?]>) => {
  const out: { date: string; value: number; note?: Tx }[] = [];
  let d = from;
  let i = 0;
  while (d <= to && i < values.length) {
    out.push({ date: d, value: values[i][0], ...(values[i][1] ? { note: values[i][1] } : {}) });
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 7);
    d = t.toISOString().slice(0, 10);
    i++;
  }
  return out;
};

// ---------------------------------------------------------------------------
// ICA-0188 (the worked example, spec 9.3)
// ---------------------------------------------------------------------------

const ICA_0188: Loan = {
  id: "ICA-0188",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Valle bajo de Ica", "Lower Ica Valley"),
  areaHa: 4.85,
  campaign: "2026-27",
  approvalDate: "2026-09-15",
  dayOfCycle: 56,
  cycleDays: 180,
  lineUsd: 36_000,
  disbursedUsd: 10_800,
  frozenUsd: 0,
  dueAtMaturityUsd: 37_800,
  maturityDate: "2027-03-14",
  state: "ambar",
  stateSince: "2026-11-08",
  coverageAtApproval: 2.1,
  coverageToday: 1.75,
  projection: { low: 1.55, high: 1.65, cause: L("si El Niño costero reduce el cuajado (-0.10x a -0.20x)", "if coastal El Niño reduces fruit set (-0.10x to -0.20x)") },
  driverDeltas: { volumen: -0.2, precio: -0.1, calidad: -0.05, cobranza: 0, prestatario: 0 },
  breakEvenPriceUsdKg: 1.11,
  expectedPriceUsdKg: 1.94,
  approvalPriceUsdKg: 2.04,
  expectedVolumeChangePct: -10,
  sbsRating: "Normal",
  scoreAtApproval: 69,
  scoreToday: 62,
  approvedTier: "B",
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 72, today: 58, why: L("Vigor del cultivo 16% bajo lo normal y precio esperado -5%", "Crop vigour 16% below normal and expected price -5%") },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 68, today: 68 },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 60, today: 60 },
  ],
  tranches: [
    { id: "T1", pct: 30, amountUsd: 10_800, status: "liberado", milestoneDate: "2026-09-15", bankConformityDate: "2026-09-14", checklist: T1_CHECKLIST },
    {
      id: "T2",
      pct: 40,
      amountUsd: 14_400,
      status: "pendiente",
      milestoneDate: "2026-11-15",
      checklist: [
        { label: L("Facturas de T1 conciliadas (96%)", "T1 invoices reconciled (96%)"), status: "ok" },
        { label: L("Central de riesgos re-consultada 05 nov", "Credit bureau re-checked 05 Nov"), status: "ok" },
        { label: L("Aforo independiente de cuajado · 15 nov", "Independent fruit-set yield estimate · 15 Nov"), status: "pending" },
        { label: L("Satélite: vigor en ámbar", "Satellite: vigour in amber"), status: "warn" },
        { label: L("Ejecutivo PyME del BCP invitado al aforo", "BCP SME officer invited to the field estimate"), status: "pending" },
      ],
      note: L("Monto final = volumen verificado en el aforo", "Final amount = volume verified in the field estimate"),
    },
    { id: "T3", pct: 30, amountUsd: 10_800, status: "previsto", milestoneDate: "2027-02-15", checklist: T3_PENDING },
  ],
  coverageHistory: [
    { date: "2026-09-15", value: 2.1 },
    { date: "2026-09-29", value: 2.1 },
    { date: "2026-10-06", value: 2.1 },
    { date: "2026-10-13", value: 2.05, note: L("precio -5%", "price -5%") },
    { date: "2026-10-27", value: 2.0, note: L("precio", "price") },
    { date: "2026-11-03", value: 1.95, note: L("calidad", "quality") },
    { date: "2026-11-10", value: 1.75, note: L("vigor -16%", "vigour -16%") },
  ],
  conditions: conditions({
    approval: "2026-09-15",
    newDebt: ["USD 18,200", "USD 19,100", "verde", L("Ninguno (+2.5% de la línea)", "None (+2.5% of the line)")],
    vigor: ["+2%", "-16%", "ambar", L("Volumen -10% · cobertura -0.20x", "Volume -10% · coverage -0.20x"), "08 nov"],
    water: ["111%", "104%"],
    price: ["USD 2.04/kg", "USD 1.94/kg", L("Cobertura -0.10x", "Coverage -0.10x")],
    exportable: ["80%", "78%", L("Cobertura -0.05x", "Coverage -0.05x")],
    invoices: [L("Plan USD 10,800", "Plan USD 10,800"), L("96% conciliado", "96% reconciled"), "verde", NONE, "04 nov"],
    work: [L("En ventana", "In window"), "verde", NONE],
    bureauDate: "05 nov",
  }),
  useOfFunds: [
    {
      tranche: "T1",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 4_200, reconciledUsd: 4_150, directPayUsd: 4_150, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 2_100, reconciledUsd: 2_100, directPayUsd: 2_100, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Riego y energía", "Irrigation and power"), budgetUsd: 1_600, reconciledUsd: 1_480, directPayUsd: 1_480, fieldMatch: L("✓ recibos", "✓ receipts") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 2_900, reconciledUsd: 2_650, directPayUsd: 0, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "pending", aforoDate: "2026-11-15" },
    },
  ],
  decisions: [
    {
      date: "2026-11-15",
      lane: "bank",
      title: L("Conformidad del T2 · se habilita el 15 nov", "T2 conformity · opens on 15 Nov"),
      basis: L(
        "Tras el aforo, TruMarket le enviará el monto recomendado del T2 calculado sobre el volumen verificado. Usted tendrá 72 horas para dar conformidad.",
        "After the field estimate, TruMarket will send you the recommended T2 amount sized on the verified volume. You will have 72 hours to give conformity.",
      ),
      evidence: [],
      engineVersion: ENGINE,
      responsible: L("BCP Riesgos", "BCP Risk"),
      dueDate: "2026-11-18",
    },
    {
      date: "2026-11-08",
      lane: "tm_contract",
      title: L("Seguimiento reforzado", "Reinforced follow-up"),
      basis: L("Vigor -16% vs línea base del lote (gatillo ámbar -15%)", "Vigour -16% vs the lot baseline (amber trigger -15%)"),
      evidence: [L("Sentinel-2 08 nov", "Sentinel-2 08 Nov")],
      engineVersion: ENGINE,
      responsible: L("TruMarket, mecánica", "TruMarket, mechanical"),
    },
    {
      date: "2026-09-15",
      lane: "tm_contract",
      title: L("T1 liberado · USD 10,800", "T1 released · USD 10,800"),
      basis: L("Checklist T1 completo", "T1 checklist complete"),
      evidence: [L("4 documentos", "4 documents")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 14 set", "TruMarket with BCP conformity 14 Sep"),
    },
  ],
  auditLog: [
    { date: "2026-11-08", event: L("Estado verde → ámbar", "State green → amber"), responsible: L("Motor · confirmado por analista TM", "Engine · confirmed by TM analyst"), rule: L("Vigor -15% vs línea base", "Vigour -15% vs baseline"), evidence: L("Sentinel-2 08 nov", "Sentinel-2 08 Nov"), engineVersion: ENGINE },
    { date: "2026-11-05", event: L("Central de riesgos re-consultada", "Credit bureau re-checked"), responsible: L("Operaciones TM", "TM Operations"), rule: L("Checklist T2", "T2 checklist"), evidence: L("Reporte de central 05 nov", "Bureau report 05 Nov"), engineVersion: ENGINE },
    { date: "2026-09-15", event: L("T1 liberado · USD 10,800", "T1 released · USD 10,800"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T1", "T1 checklist"), evidence: L("4 documentos", "4 documents"), engineVersion: ENGINE },
    { date: "2026-09-12", event: L("Tier B confirmado", "Tier B confirmed"), responsible: L("Analista TM", "TM analyst"), rule: L("Score 69", "Score 69"), evidence: L("Memorando de evaluación", "Assessment memo"), engineVersion: ENGINE },
  ],
  summary: L("Vigor del cultivo 16% bajo lo normal: volumen esperado 10% menor. El T2 se calcula sobre el aforo del 15 nov.", "Crop vigour 16% below normal: expected volume 10% lower. T2 is sized on the 15 Nov field estimate."),
  next: { date: "2026-11-15", label: L("T2 hasta USD 14,400 · aforo 15 nov", "T2 up to USD 14,400 · field estimate 15 Nov"), amountUsd: 14_400 },
  causes: [
    { status: "confirmado", text: L("El cultivo está menos vigoroso de lo normal. Se espera una cosecha 10% menor.", "The crop is less vigorous than normal. A 10% smaller harvest is expected."), effect: L("-0.20x", "-0.20x"), condition: "Vigor del cultivo vs lo normal del lote" },
    { status: "confirmado", text: L("El precio esperado bajó 5% y la fruta exportable 2 puntos.", "The expected price fell 5% and exportable fruit 2 points."), effect: L("-0.15x", "-0.15x"), condition: "Precio esperado a cosecha" },
    { status: "observacion", text: L("El mar frente a la costa está mucho más caliente de lo normal. Puede reducir el cuajado.", "The sea off the coast is much warmer than normal. It may reduce fruit set."), effect: L("-0.10x a -0.20x", "-0.10x to -0.20x"), condition: "El Niño costero" },
    { status: "bajo_control", text: L("El productor, el agua y el uso de fondos están en orden.", "The grower, the water and the use of funds are in order."), effect: L("0.00x", "0.00x") },
  ],
  situation: [
    L("Cosecha esperada **10% menor**: vigor del cultivo 16% bajo lo normal", "Expected harvest **10% smaller**: crop vigour 16% below normal"),
    L("Cobertura **1.75x**, sobre el umbral de 1.50x", "Coverage **1.75x**, above the 1.50x threshold"),
    L("Expuesto: **USD 10,800**. El T2 se calcula sobre el aforo del 15 nov", "Exposed: **USD 10,800**. T2 is sized on the 15 Nov field estimate"),
    L("Productor, agua y uso de fondos en orden. **No requiere decisión del banco hoy**", "Grower, water and use of funds in order. **No bank decision required today**"),
  ],
};

// ---------------------------------------------------------------------------
// ICA-0201 (naranja: the exception, spec 9.4)
// ---------------------------------------------------------------------------

const ICA_0201: Loan = {
  id: "ICA-0201",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Santiago, Ica", "Santiago, Ica"),
  areaHa: 3.4,
  campaign: "2026-27",
  approvalDate: "2026-08-25",
  dayOfCycle: 77,
  cycleDays: 200,
  lineUsd: 24_000,
  disbursedUsd: 16_800,
  frozenUsd: 7_200,
  dueAtMaturityUsd: 25_200,
  maturityDate: "2027-03-13",
  state: "naranja",
  stateSince: "2026-11-06",
  coverageAtApproval: 1.65,
  coverageToday: 1.57,
  projection: { low: 0.95, high: 1.2, cause: L("si la fertilización tardía no se remedia (-0.27x a -0.42x) y El Niño costero reduce el cuajado (-0.10x a -0.20x)", "if the late fertilisation is not remedied (-0.27x to -0.42x) and coastal El Niño reduces fruit set (-0.10x to -0.20x)") },
  driverDeltas: { volumen: 0, precio: -0.08, calidad: 0, cobranza: 0, prestatario: 0 },
  breakEvenPriceUsdKg: 1.24,
  expectedPriceUsdKg: 1.94,
  approvalPriceUsdKg: 2.04,
  expectedVolumeChangePct: 0,
  sbsRating: "Normal",
  scoreAtApproval: 66,
  scoreToday: 58,
  approvedTier: "B",
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 64, today: 56, why: L("Precio esperado -5%; fertilización tardía", "Expected price -5%; late fertilisation") },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 70, today: 60, why: L("Facturas de la fase 2 al 68%", "Phase 2 invoices at 68%") },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 63, today: 63 },
  ],
  tranches: [
    { id: "T1", pct: 30, amountUsd: 7_200, status: "liberado", milestoneDate: "2026-08-25", bankConformityDate: "2026-08-24", checklist: T1_CHECKLIST },
    { id: "T2", pct: 40, amountUsd: 9_600, status: "liberado", milestoneDate: "2026-10-20", bankConformityDate: "2026-10-19", checklist: T2_DONE(98, "15 oct") },
    {
      id: "T3",
      pct: 30,
      amountUsd: 7_200,
      status: "congelado",
      milestoneDate: "2027-02-05",
      checklist: [
        { label: L("Facturas de T2 conciliadas (68%)", "T2 invoices reconciled (68%)"), status: "fail" },
        { label: L("Fertilización en ventana (3 semanas tarde)", "Fertilisation in window (3 weeks late)"), status: "fail" },
        ...T3_PENDING,
      ],
      note: L("Congelado el 06 nov hasta verificar la remediación", "Frozen on 06 Nov until remediation is verified"),
    },
  ],
  coverageHistory: weekly("2026-08-25", CUTOFF, [[1.65], [1.65], [1.65], [1.65], [1.65], [1.65], [1.65], [1.62, L("precio", "price")], [1.62], [1.6], [1.6], [1.57, L("precio", "price")]]),
  conditions: conditions({
    approval: "2026-08-25",
    newDebt: ["USD 6,000", "USD 6,000", "verde", NONE],
    vigor: ["0%", "-6%", "verde", NONE, "08 nov"],
    water: ["108%", "103%"],
    price: ["USD 2.04/kg", "USD 1.94/kg", L("Cobertura -0.08x", "Coverage -0.08x")],
    exportable: ["78%", "78%", NONE],
    invoices: [L("Plan USD 16,800", "Plan USD 16,800"), L("81% conciliado · T2 68%", "81% reconciled · T2 68%"), "naranja", L("T3 de USD 7,200 congelado", "T3 of USD 7,200 frozen"), "04 nov"],
    work: [L("Fertilización 3 semanas tarde", "Fertilisation 3 weeks late"), "ambar", L("Calibre y volumen en riesgo · estimado", "Fruit size and volume at risk · estimated")],
    bureauDate: "15 oct",
  }),
  useOfFunds: [
    {
      tranche: "T1",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 3_000, reconciledUsd: 2_960, directPayUsd: 2_600, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 1_600, reconciledUsd: 1_600, directPayUsd: 1_400, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 2_600, reconciledUsd: 2_492, directPayUsd: 600, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "ok", aforoDate: "2026-10-18" },
    },
    {
      tranche: "T2",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 4_800, reconciledUsd: 2_408, directPayUsd: 2_408, fieldMatch: L("! aplicación 3 semanas tarde", "! applied 3 weeks late") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 2_200, reconciledUsd: 2_200, directPayUsd: 1_632, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 2_600, reconciledUsd: 1_920, directPayUsd: 600, fieldMatch: L("! planilla incompleta", "! payroll incomplete") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: false, satelite: false, aforo: "pending", aforoDate: "2026-11-20" },
    },
  ],
  decisions: [
    {
      date: "2026-11-06",
      lane: "tm_contract",
      title: L("T3 congelado · USD 7,200", "T3 frozen · USD 7,200"),
      basis: L("Facturas de fase 2 conciliadas solo al 68% (brecha de 32%, gatillo naranja) y fertilización 3 semanas fuera de ventana", "Phase 2 invoices only 68% reconciled (32% gap, orange trigger) and fertilisation 3 weeks outside the window"),
      evidence: [L("Facturas electrónicas 04 nov", "E-invoices 04 Nov"), L("Sentinel-2 + fotos 08 nov", "Sentinel-2 + photos 08 Nov")],
      engineVersion: ENGINE,
      responsible: L("TruMarket, mecánica · reportado el mismo día", "TruMarket, mechanical · reported the same day"),
    },
    {
      date: "2026-10-20",
      lane: "tm_contract",
      title: L("T2 liberado · USD 9,600", "T2 released · USD 9,600"),
      basis: L("Checklist T2 completo", "T2 checklist complete"),
      evidence: [L("Aforo 18 oct", "Field estimate 18 Oct")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 19 oct", "TruMarket with BCP conformity 19 Oct"),
    },
  ],
  auditLog: [
    { date: "2026-11-06", event: L("Estado ámbar → naranja · T3 congelado", "State amber → orange · T3 frozen"), responsible: L("Motor · confirmado por analista TM", "Engine · confirmed by TM analyst"), rule: L("Brecha de facturas 32% (naranja desde 30%) · labores +3 semanas (ámbar desde +2)", "Invoice gap 32% (orange from 30%) · field work +3 weeks (amber from +2)"), evidence: L("Facturas 04 nov · Sentinel-2 08 nov", "Invoices 04 Nov · Sentinel-2 08 Nov"), engineVersion: ENGINE },
    { date: "2026-10-20", event: L("T2 liberado · USD 9,600", "T2 released · USD 9,600"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T2", "T2 checklist"), evidence: L("Aforo 18 oct", "Field estimate 18 Oct"), engineVersion: ENGINE },
    { date: "2026-08-25", event: L("T1 liberado · USD 7,200", "T1 released · USD 7,200"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T1", "T1 checklist"), evidence: L("4 documentos", "4 documents"), engineVersion: ENGINE },
  ],
  summary: L("T3 de USD 7,200 congelado: facturas de la fase 2 al 68% y fertilización 3 semanas tarde. Exposición limitada a USD 16,800.", "T3 of USD 7,200 frozen: phase 2 invoices at 68% and fertilisation 3 weeks late. Exposure limited to USD 16,800."),
  next: { date: "2026-11-20", label: L("Aforo adelantado · T3 USD 7,200 congelado", "Field estimate brought forward · T3 USD 7,200 frozen"), amountUsd: 7_200 },
  causes: [
    { status: "confirmado", text: L("Las facturas de la fase 2 cubren solo 68% de lo desembolsado.", "Phase 2 invoices cover only 68% of what was disbursed."), effect: L("T3 congelado", "T3 frozen"), condition: "Facturas de tramos vs presupuesto" },
    { status: "confirmado", text: L("La fertilización se aplicó 3 semanas tarde.", "Fertiliser was applied 3 weeks late."), effect: L("-0.27x a -0.42x · estimado", "-0.27x to -0.42x · estimated"), condition: "Labores en ventana" },
    { status: "observacion", text: L("El Niño costero extraordinario puede reducir el cuajado.", "The extraordinary coastal El Niño may reduce fruit set."), effect: L("-0.10x a -0.20x · estimado", "-0.10x to -0.20x · estimated"), condition: "El Niño costero" },
    { status: "confirmado", text: L("El precio esperado bajó 5%.", "The expected price fell 5%."), effect: L("-0.08x", "-0.08x"), condition: "Precio esperado a cosecha" },
    { status: "bajo_control", text: L("Clasificación SBS, agua y cesión de cobros en orden.", "SBS rating, water and assignment of receivables in order."), effect: L("0.00x", "0.00x") },
  ],
  situation: [
    L("**T3 de USD 7,200 congelado** el 06 nov, el mismo día del desvío", "**T3 of USD 7,200 frozen** on 06 Nov, the day of the deviation"),
    L("Cobertura **1.57x** confirmada; estimado **0.95x a 1.20x** si no se remedia y El Niño reduce el cuajado", "Coverage **1.57x** confirmed; estimated **0.95x to 1.20x** if not remedied and El Niño reduces fruit set"),
    L("Expuesto: **USD 16,800**, limitado a lo desembolsado", "Exposed: **USD 16,800**, limited to what was disbursed"),
    L("Plan de remediación al 05 dic. **No requiere decisión del banco hoy**", "Remediation plan due 05 Dec. **No bank decision required today**"),
  ],
};

// ---------------------------------------------------------------------------
// ICA-0215, PIS-0034, ICA-0142
// ---------------------------------------------------------------------------

const ICA_0215: Loan = {
  id: "ICA-0215",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Pueblo Nuevo, Ica", "Pueblo Nuevo, Ica"),
  areaHa: 4.3,
  campaign: "2026-27",
  approvalDate: "2026-10-01",
  dayOfCycle: 40,
  cycleDays: 195,
  lineUsd: 32_000,
  disbursedUsd: 9_600,
  frozenUsd: 0,
  dueAtMaturityUsd: 33_600,
  maturityDate: "2027-04-14",
  state: "ambar",
  stateSince: "2026-11-03",
  coverageAtApproval: 1.62,
  coverageToday: 1.6,
  projection: { low: 1.4, high: 1.5, cause: L("si El Niño costero reduce el cuajado (-0.10x a -0.20x)", "if coastal El Niño reduces fruit set (-0.10x to -0.20x)") },
  driverDeltas: { volumen: 0, precio: -0.02, calidad: 0, cobranza: 0, prestatario: 0 },
  breakEvenPriceUsdKg: 1.21,
  expectedPriceUsdKg: 1.94,
  approvalPriceUsdKg: 1.98,
  expectedVolumeChangePct: 0,
  sbsRating: "Normal",
  scoreAtApproval: 64,
  scoreToday: 61,
  approvedTier: "C",
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 66, today: 66 },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 62, today: 54, why: L("Nueva deuda por 24% de la línea", "New debt of 24% of the line") },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 60, today: 60 },
  ],
  tranches: [
    { id: "T1", pct: 30, amountUsd: 9_600, status: "liberado", milestoneDate: "2026-10-01", bankConformityDate: "2026-09-30", checklist: T1_CHECKLIST },
    {
      id: "T2",
      pct: 40,
      amountUsd: 12_800,
      status: "pendiente",
      milestoneDate: "2026-11-20",
      checklist: [
        { label: L("Facturas de T1 conciliadas (94%)", "T1 invoices reconciled (94%)"), status: "ok" },
        { label: L("Central de riesgos: deuda nueva 24% de la línea", "Credit bureau: new debt 24% of the line"), status: "warn" },
        { label: L("Aforo independiente de cuajado · 20 nov", "Independent fruit-set yield estimate · 20 Nov"), status: "pending" },
        { label: L("Labores en ventana", "Field work within window"), status: "ok" },
      ],
      note: L("Monto final = volumen verificado en el aforo", "Final amount = volume verified in the field estimate"),
    },
    { id: "T3", pct: 30, amountUsd: 9_600, status: "previsto", milestoneDate: "2027-03-01", checklist: T3_PENDING },
  ],
  coverageHistory: weekly("2026-10-01", CUTOFF, [[1.62], [1.62], [1.62], [1.61], [1.6, L("precio", "price")], [1.6], [1.6]]),
  conditions: conditions({
    approval: "2026-10-01",
    newDebt: ["USD 0", "USD 7,680", "ambar", L("Capacidad de pago en seguimiento · cobertura sin cambio", "Repayment capacity under follow-up · coverage unchanged")],
    vigor: ["+1%", "-3%", "verde", NONE, "08 nov"],
    water: ["110%", "106%"],
    price: ["USD 1.98/kg", "USD 1.94/kg", L("Cobertura -0.02x", "Coverage -0.02x")],
    exportable: ["79%", "79%", NONE],
    invoices: [L("Plan USD 9,600", "Plan USD 9,600"), L("94% conciliado", "94% reconciled"), "verde", NONE, "04 nov"],
    work: [L("En ventana", "In window"), "verde", NONE],
    bureauDate: "03 nov",
  }),
  useOfFunds: [
    {
      tranche: "T1",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 4_000, reconciledUsd: 3_900, directPayUsd: 3_900, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 2_200, reconciledUsd: 2_200, directPayUsd: 2_200, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Riego y energía", "Irrigation and power"), budgetUsd: 1_580, reconciledUsd: 1_580, directPayUsd: 1_580, fieldMatch: L("✓ recibos", "✓ receipts") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 1_820, reconciledUsd: 1_340, directPayUsd: 0, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "pending", aforoDate: "2026-11-20" },
    },
  ],
  decisions: [
    {
      date: "2026-11-03",
      lane: "tm_contract",
      title: L("Seguimiento reforzado", "Reinforced follow-up"),
      basis: L("Deuda nueva por 24% de la línea (gatillo ámbar 20%)", "New debt of 24% of the line (amber trigger 20%)"),
      evidence: [L("Central de riesgos 03 nov", "Credit bureau 03 Nov")],
      engineVersion: ENGINE,
      responsible: L("TruMarket, mecánica", "TruMarket, mechanical"),
    },
    {
      date: "2026-10-01",
      lane: "tm_contract",
      title: L("T1 liberado · USD 9,600", "T1 released · USD 9,600"),
      basis: L("Checklist T1 completo", "T1 checklist complete"),
      evidence: [L("4 documentos", "4 documents")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 30 set", "TruMarket with BCP conformity 30 Sep"),
    },
  ],
  auditLog: [
    { date: "2026-11-03", event: L("Estado verde → ámbar", "State green → amber"), responsible: L("Motor · confirmado por analista TM", "Engine · confirmed by TM analyst"), rule: L("Deuda nueva > 20% de la línea", "New debt > 20% of the line"), evidence: L("Central de riesgos 03 nov", "Credit bureau 03 Nov"), engineVersion: ENGINE },
    { date: "2026-10-01", event: L("T1 liberado · USD 9,600", "T1 released · USD 9,600"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T1", "T1 checklist"), evidence: L("4 documentos", "4 documents"), engineVersion: ENGINE },
  ],
  summary: L("Nueva deuda del productor por 24% de la línea. Capacidad de pago en seguimiento; cobertura sin cambio (1.60x).", "Grower took new debt of 24% of the line. Repayment capacity under follow-up; coverage unchanged (1.60x)."),
  next: { date: "2026-11-20", label: L("T2 USD 12,800 · 20 nov", "T2 USD 12,800 · 20 Nov"), amountUsd: 12_800 },
  causes: [
    { status: "confirmado", text: L("El productor tomó nueva deuda por 24% de la línea.", "The grower took new debt of 24% of the line."), effect: L("0.00x · capacidad en seguimiento", "0.00x · capacity under follow-up"), condition: "Deuda nueva en el sistema" },
    { status: "confirmado", text: L("El precio esperado bajó 2%.", "The expected price fell 2%."), effect: L("-0.02x", "-0.02x"), condition: "Precio esperado a cosecha" },
    { status: "observacion", text: L("El Niño costero extraordinario puede reducir el cuajado.", "The extraordinary coastal El Niño may reduce fruit set."), effect: L("-0.10x a -0.20x · estimado", "-0.10x to -0.20x · estimated"), condition: "El Niño costero" },
    { status: "bajo_control", text: L("Cultivo, agua y uso de fondos en orden.", "Crop, water and use of funds in order."), effect: L("0.00x", "0.00x") },
  ],
  situation: [
    L("Nueva deuda del productor: **24% de la línea**", "New grower debt: **24% of the line**"),
    L("Cobertura **1.60x**, sobre el umbral de 1.50x", "Coverage **1.60x**, above the 1.50x threshold"),
    L("Expuesto: **USD 9,600**. El T2 se calcula sobre el aforo del 20 nov", "Exposed: **USD 9,600**. T2 is sized on the 20 Nov field estimate"),
    L("Cultivo, agua y uso de fondos en orden. **No requiere decisión del banco hoy**", "Crop, water and use of funds in order. **No bank decision required today**"),
  ],
};

const PIS_0034: Loan = {
  id: "PIS-0034",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Pisco", "Pisco"),
  areaHa: 3.9,
  campaign: "2026-27",
  approvalDate: "2026-09-22",
  dayOfCycle: 49,
  cycleDays: 205,
  lineUsd: 28_000,
  disbursedUsd: 8_400,
  frozenUsd: 0,
  dueAtMaturityUsd: 29_400,
  maturityDate: "2027-04-15",
  state: "verde",
  stateSince: "2026-09-22",
  coverageAtApproval: 1.95,
  coverageToday: 1.9,
  projection: { low: 1.7, high: 1.8, cause: L("si El Niño costero reduce el cuajado (-0.10x a -0.20x)", "if coastal El Niño reduces fruit set (-0.10x to -0.20x)") },
  driverDeltas: { volumen: 0, precio: -0.05, calidad: 0, cobranza: 0, prestatario: 0 },
  breakEvenPriceUsdKg: 1.02,
  expectedPriceUsdKg: 1.94,
  approvalPriceUsdKg: 1.99,
  expectedVolumeChangePct: 0,
  sbsRating: "Normal",
  scoreAtApproval: 72,
  scoreToday: 71,
  approvedTier: "B",
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 74, today: 72, why: L("Precio esperado -2.5%", "Expected price -2.5%") },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 70, today: 70 },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 70, today: 70 },
  ],
  tranches: [
    { id: "T1", pct: 30, amountUsd: 8_400, status: "liberado", milestoneDate: "2026-09-22", bankConformityDate: "2026-09-21", checklist: T1_CHECKLIST },
    {
      id: "T2",
      pct: 40,
      amountUsd: 11_200,
      status: "pendiente",
      milestoneDate: "2026-11-08",
      checklist: [
        { label: L("Facturas de T1 conciliadas (99%)", "T1 invoices reconciled (99%)"), status: "ok" },
        { label: L("Aforo independiente de cuajado · 07 nov", "Independent fruit-set yield estimate · 07 Nov"), status: "ok" },
        { label: L("Central de riesgos re-consultada 05 nov", "Credit bureau re-checked 05 Nov"), status: "ok" },
        { label: L("Labores en ventana", "Field work within window"), status: "ok" },
        { label: L("Conformidad del banco", "Bank conformity"), status: "pending" },
      ],
      note: L("Aforo confirma el volumen declarado: monto completo", "Field estimate confirms the declared volume: full amount"),
    },
    { id: "T3", pct: 30, amountUsd: 8_400, status: "previsto", milestoneDate: "2027-02-20", checklist: T3_PENDING },
  ],
  coverageHistory: weekly("2026-09-22", CUTOFF, [[1.95], [1.95], [1.95], [1.93, L("precio", "price")], [1.92], [1.9], [1.9], [1.9]]),
  conditions: conditions({
    approval: "2026-09-22",
    newDebt: ["USD 4,000", "USD 4,000", "verde", NONE],
    vigor: ["+3%", "+1%", "verde", NONE, "08 nov"],
    water: ["112%", "107%"],
    price: ["USD 1.99/kg", "USD 1.94/kg", L("Cobertura -0.05x", "Coverage -0.05x")],
    exportable: ["81%", "81%", NONE],
    invoices: [L("Plan USD 8,400", "Plan USD 8,400"), L("99% conciliado", "99% reconciled"), "verde", NONE, "04 nov"],
    work: [L("En ventana", "In window"), "verde", NONE],
    bureauDate: "05 nov",
  }),
  useOfFunds: [
    {
      tranche: "T1",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 3_400, reconciledUsd: 3_400, directPayUsd: 3_400, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 1_900, reconciledUsd: 1_900, directPayUsd: 1_900, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Riego y energía", "Irrigation and power"), budgetUsd: 1_840, reconciledUsd: 1_840, directPayUsd: 1_840, fieldMatch: L("✓ recibos", "✓ receipts") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 1_260, reconciledUsd: 1_180, directPayUsd: 0, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "ok", aforoDate: "2026-11-07" },
    },
  ],
  decisions: [
    {
      date: "2026-11-09",
      lane: "bank",
      title: L("Conformidad del T2 por USD 11,200", "T2 conformity for USD 11,200"),
      basis: L(
        "Checklist T2 completo: facturas de T1 99% conciliadas, aforo del 07 nov confirma el volumen declarado, central de riesgos sin cambios. Cobertura 1.90x. TruMarket recomienda dar conformidad por el monto completo.",
        "T2 checklist complete: T1 invoices 99% reconciled, the 07 Nov field estimate confirms the declared volume, credit bureau unchanged. Coverage 1.90x. TruMarket recommends conformity for the full amount.",
      ),
      evidence: [L("Aforo 07 nov", "Field estimate 07 Nov"), L("Facturas 04 nov", "Invoices 04 Nov"), L("Central 05 nov", "Bureau 05 Nov")],
      engineVersion: ENGINE,
      responsible: L("BCP Riesgos", "BCP Risk"),
      dueDate: "2026-11-12",
    },
    {
      date: "2026-09-22",
      lane: "tm_contract",
      title: L("T1 liberado · USD 8,400", "T1 released · USD 8,400"),
      basis: L("Checklist T1 completo", "T1 checklist complete"),
      evidence: [L("4 documentos", "4 documents")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 21 set", "TruMarket with BCP conformity 21 Sep"),
    },
  ],
  auditLog: [
    { date: "2026-11-09", event: L("Conformidad del T2 solicitada al banco", "T2 conformity requested from the bank"), responsible: L("Operaciones TM", "TM Operations"), rule: L("Checklist T2 completo", "T2 checklist complete"), evidence: L("Aforo 07 nov", "Field estimate 07 Nov"), engineVersion: ENGINE },
    { date: "2026-09-22", event: L("T1 liberado · USD 8,400", "T1 released · USD 8,400"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T1", "T1 checklist"), evidence: L("4 documentos", "4 documents"), engineVersion: ENGINE },
  ],
  summary: L("Aforo del 07 nov confirma el volumen. T2 de USD 11,200 listo: espera la conformidad del banco.", "The 07 Nov field estimate confirms the volume. T2 of USD 11,200 ready: awaiting the bank's conformity."),
  next: { date: "2026-11-12", label: L("T2 USD 11,200 · conformidad del banco", "T2 USD 11,200 · bank conformity"), amountUsd: 11_200 },
  causes: [
    { status: "confirmado", text: L("El precio esperado bajó 2.5%.", "The expected price fell 2.5%."), effect: L("-0.05x", "-0.05x"), condition: "Precio esperado a cosecha" },
    { status: "observacion", text: L("El Niño costero extraordinario puede reducir el cuajado.", "The extraordinary coastal El Niño may reduce fruit set."), effect: L("-0.10x a -0.20x · estimado", "-0.10x to -0.20x · estimated"), condition: "El Niño costero" },
    { status: "bajo_control", text: L("Cultivo, productor y uso de fondos en orden.", "Crop, grower and use of funds in order."), effect: L("0.00x", "0.00x") },
  ],
  situation: [
    L("Aforo del 07 nov: **volumen declarado confirmado**", "07 Nov field estimate: **declared volume confirmed**"),
    L("Cobertura **1.90x**, sobre el umbral de 1.50x", "Coverage **1.90x**, above the 1.50x threshold"),
    L("Expuesto: **USD 8,400**. T2 de USD 11,200 listo para liberar", "Exposed: **USD 8,400**. T2 of USD 11,200 ready to release"),
    L("**Requiere la conformidad del banco antes del 12 nov**", "**Bank conformity required by 12 Nov**"),
  ],
};

const ICA_0142: Loan = {
  id: "ICA-0142",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Villacurí, Ica", "Villacurí, Ica"),
  areaHa: 9.28,
  campaign: "2026-27",
  approvalDate: "2026-09-01",
  dayOfCycle: 70,
  cycleDays: 195,
  lineUsd: 30_000,
  disbursedUsd: 21_000,
  frozenUsd: 0,
  dueAtMaturityUsd: 31_500,
  maturityDate: "2027-03-15",
  state: "verde",
  stateSince: "2026-09-01",
  coverageAtApproval: 2.0,
  coverageToday: 2.05,
  projection: { low: 1.85, high: 1.95, cause: L("si El Niño costero reduce el cuajado (-0.10x a -0.20x)", "if coastal El Niño reduces fruit set (-0.10x to -0.20x)") },
  driverDeltas: { volumen: 0.05, precio: 0, calidad: 0, cobranza: 0, prestatario: 0 },
  breakEvenPriceUsdKg: 0.95,
  expectedPriceUsdKg: 1.94,
  approvalPriceUsdKg: 1.94,
  expectedVolumeChangePct: 3,
  sbsRating: "Normal",
  scoreAtApproval: 70,
  scoreToday: 72,
  approvedTier: "B",
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 70, today: 74, why: L("Aforo 3% sobre lo declarado", "Field estimate 3% above declared") },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 72, today: 72 },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 66, today: 66 },
  ],
  tranches: [
    { id: "T1", pct: 30, amountUsd: 9_000, status: "liberado", milestoneDate: "2026-09-01", bankConformityDate: "2026-08-31", checklist: T1_CHECKLIST },
    { id: "T2", pct: 40, amountUsd: 12_000, status: "liberado", milestoneDate: "2026-11-03", bankConformityDate: "2026-11-02", checklist: T2_DONE(97, "28 oct") },
    { id: "T3", pct: 30, amountUsd: 9_000, status: "previsto", milestoneDate: "2027-02-15", checklist: T3_PENDING },
  ],
  coverageHistory: weekly("2026-09-01", CUTOFF, [[2.0], [2.0], [2.0], [2.0], [2.0], [2.0], [2.0], [2.0], [2.0], [2.05, L("aforo +3%", "estimate +3%")], [2.05]]),
  conditions: conditions({
    approval: "2026-09-01",
    newDebt: ["USD 0", "USD 0", "verde", NONE],
    vigor: ["+4%", "+6%", "verde", NONE, "08 nov"],
    water: ["115%", "109%"],
    price: ["USD 1.94/kg", "USD 1.94/kg", NONE],
    exportable: ["82%", "82%", NONE],
    invoices: [L("Plan USD 21,000", "Plan USD 21,000"), L("97% conciliado", "97% reconciled"), "verde", NONE, "04 nov"],
    work: [L("En ventana", "In window"), "verde", NONE],
    bureauDate: "28 oct",
  }),
  useOfFunds: [
    {
      tranche: "T1",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 3_800, reconciledUsd: 3_800, directPayUsd: 3_800, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 1_900, reconciledUsd: 1_900, directPayUsd: 1_900, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Riego y energía", "Irrigation and power"), budgetUsd: 1_300, reconciledUsd: 1_300, directPayUsd: 1_300, fieldMatch: L("✓ recibos", "✓ receipts") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 2_000, reconciledUsd: 1_700, directPayUsd: 0, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "ok", aforoDate: "2026-10-28" },
    },
    {
      tranche: "T2",
      lines: [
        { item: L("Fertilizantes", "Fertilisers"), budgetUsd: 5_200, reconciledUsd: 5_200, directPayUsd: 5_200, fieldMatch: L("✓ satélite y fotos", "✓ satellite and photos") },
        { item: L("Sanidad", "Plant health"), budgetUsd: 2_600, reconciledUsd: 2_600, directPayUsd: 2_600, fieldMatch: L("✓ registro fitosanitario", "✓ phytosanitary record") },
        { item: L("Riego y energía", "Irrigation and power"), budgetUsd: 1_580, reconciledUsd: 1_580, directPayUsd: 1_580, fieldMatch: L("✓ recibos", "✓ receipts") },
        { item: L("Mano de obra (tope por fase)", "Labour (capped per phase)"), budgetUsd: 2_620, reconciledUsd: 2_290, directPayUsd: 0, fieldMatch: L("✓ planilla firmada", "✓ signed payroll") },
      ],
      cashWithdrawnUsd: 0,
      threeSources: { facturas: true, satelite: true, aforo: "ok", aforoDate: "2026-10-28" },
    },
  ],
  decisions: [
    {
      date: "2026-11-03",
      lane: "tm_contract",
      title: L("T2 liberado · USD 12,000", "T2 released · USD 12,000"),
      basis: L("Checklist T2 completo · aforo 3% sobre lo declarado", "T2 checklist complete · field estimate 3% above declared"),
      evidence: [L("Aforo 28 oct", "Field estimate 28 Oct")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 02 nov", "TruMarket with BCP conformity 02 Nov"),
    },
    {
      date: "2026-09-01",
      lane: "tm_contract",
      title: L("T1 liberado · USD 9,000", "T1 released · USD 9,000"),
      basis: L("Checklist T1 completo", "T1 checklist complete"),
      evidence: [L("4 documentos", "4 documents")],
      engineVersion: ENGINE,
      responsible: L("TruMarket con conformidad BCP 31 ago", "TruMarket with BCP conformity 31 Aug"),
    },
  ],
  auditLog: [
    { date: "2026-11-03", event: L("T2 liberado · USD 12,000", "T2 released · USD 12,000"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T2", "T2 checklist"), evidence: L("Aforo 28 oct", "Field estimate 28 Oct"), engineVersion: ENGINE },
    { date: "2026-09-01", event: L("T1 liberado · USD 9,000", "T1 released · USD 9,000"), responsible: L("Operaciones TM · conformidad BCP", "TM Operations · BCP conformity"), rule: L("Checklist T1", "T1 checklist"), evidence: L("4 documentos", "4 documents"), engineVersion: ENGINE },
  ],
  summary: L("Aforo 3% sobre lo declarado: cobertura subió a 2.05x. T3 previsto 15 feb.", "Field estimate 3% above declared: coverage up to 2.05x. T3 planned 15 Feb."),
  next: { date: "2027-02-15", label: L("T3 USD 9,000 · 15 feb", "T3 USD 9,000 · 15 Feb"), amountUsd: 9_000 },
  causes: [
    { status: "confirmado", text: L("El aforo encontró 3% más fruta que lo declarado.", "The field estimate found 3% more fruit than declared."), effect: L("+0.05x", "+0.05x") },
    { status: "observacion", text: L("El Niño costero extraordinario puede reducir el cuajado.", "The extraordinary coastal El Niño may reduce fruit set."), effect: L("-0.10x a -0.20x · estimado", "-0.10x to -0.20x · estimated"), condition: "El Niño costero" },
    { status: "bajo_control", text: L("Productor, agua y uso de fondos en orden.", "Grower, water and use of funds in order."), effect: L("0.00x", "0.00x") },
  ],
  situation: [
    L("Aforo **3% sobre lo declarado**", "Field estimate **3% above declared**"),
    L("Cobertura **2.05x**, sobre el umbral de 1.50x", "Coverage **2.05x**, above the 1.50x threshold"),
    L("Expuesto: **USD 21,000**. T3 de USD 9,000 previsto el 15 feb", "Exposed: **USD 21,000**. T3 of USD 9,000 planned 15 Feb"),
    L("Todo en orden. **No requiere decisión del banco hoy**", "All in order. **No bank decision required today**"),
  ],
};


// ---------------------------------------------------------------------------
// Applications awaiting the bank's decision
// ---------------------------------------------------------------------------

const ICA_0177_APP: Application = {
  id: "ICA-0177",
  crop: L("Palta Hass (declarada)", "Hass avocado (declared)"),
  zone: L("Pampa de Villacurí, Ica", "Pampa de Villacurí, Ica"),
  areaHa: 8.79,
  campaign: "2026-27",
  receivedDate: "2026-10-28",
  decisionDueDate: "2026-11-14",
  requestedUsd: 66_000,
  tenorDays: 180,
  dueAtMaturityUsd: 69_300,
  tranches: [
    { id: "T1", pct: 30, amountUsd: 19_800, milestone: L("a la firma", "at signing") },
    { id: "T2", pct: 40, amountUsd: 26_400, milestone: L("cuajado verificado", "verified fruit set") },
    { id: "T3", pct: 30, amountUsd: 19_800, milestone: L("pre-cosecha", "pre-harvest") },
  ],
  coverage: null,
  breakEvenPriceUsdKg: null,
  expectedPriceUsdKg: 1.94,
  score: 55,
  tier: "C",
  veto: true,
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 42, today: 42, why: L("El cultivo del predio no coincide con lo declarado", "The parcel's crop does not match the declaration") },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 70, today: 70 },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 63, today: 63 },
  ],
  recommendation: "rechazar",
  summary: L(
    "Aprobar pondría USD 66,000 durante 180 días sobre una cosecha que no se puede verificar: el predio no muestra palta Hass.",
    "Approving would put USD 66,000 for 180 days on a harvest that cannot be verified: the parcel does not show Hass avocado.",
  ),
  reasons: [
    L("El patrón satelital del predio no corresponde a palta Hass: el vigor cae a 0.26 en su punto más bajo del año, como un cultivo que se poda o descansa (por ejemplo, vid).", "The parcel's satellite pattern does not match Hass avocado: vigour falls to 0.26 at its low point of the year, like a crop that is pruned or rests (for example, vines)."),
    L("Sin cultivo verificable no hay base para medir el volumen ni la cobertura de repago.", "Without a verifiable crop there is no basis to measure volume or repayment coverage."),
    L("Si el productor objeta el hallazgo, TruMarket recomienda una inspección de campo antes de reconsiderar.", "If the grower disputes the finding, TruMarket recommends a field inspection before reconsidering."),
  ],
  checks: [
    { group: "Cultivo y volumen", label: L("Cultivo declarado vs observado", "Declared vs observed crop"), value: L("Palta Hass declarada · patrón de cultivo de temporada", "Hass avocado declared · seasonal crop pattern"), state: "veto", effect: L("Cosecha no verificable", "Harvest cannot be verified"), provenance: "satelital", source: L("Sentinel-2 · historia 2022-2026", "Sentinel-2 · 2022-2026 history"), real: true },
    { group: "Cultivo y volumen", label: L("Área declarada vs medida", "Declared vs measured area"), value: L("8.82 ha declaradas · 8.79 ha medidas", "8.82 ha declared · 8.79 ha measured"), state: "verde", effect: NONE, provenance: "satelital", source: L("Contorno del predio · Sentinel-2", "Parcel outline · Sentinel-2"), real: true },
    { group: "Cultivo y volumen", label: L("Agua disponible vs necesidad", "Water available vs need"), value: L("109%", "109%"), state: "verde", effect: NONE, provenance: "satelital", source: L("ERA5 + licencia · 09 nov", "ERA5 + licence · 09 Nov") },
    { group: "Prestatario", label: L("Clasificación SBS", "SBS rating"), value: L("Normal · 0 protestos", "Normal · 0 protested debts"), state: "verde", effect: NONE, provenance: "doc_verificado", source: L("Central de riesgos · 30 oct", "Credit bureau · 30 Oct") },
    { group: "Prestatario", label: L("Tenencia del predio y gravámenes", "Land tenure and liens"), value: L("Título propio · 1 gravamen", "Own title · 1 lien"), state: "ambar", effect: L("Garantía limitada", "Limited collateral"), provenance: "doc_verificado", source: L("SUNARP · 30 oct", "SUNARP · 30 Oct") },
    { group: "Uso de fondos y cobranza", label: L("Comprador con cobertura activable", "Buyer with activatable cover"), value: L("Solicitada · pendiente", "Requested · pending"), state: "observacion", effect: L("Se confirma antes del T3", "Confirmed before T3"), provenance: "declarado", source: L("Solicitud · 28 oct", "Application · 28 Oct") },
  ],
};

const ICA_0244_APP: Application = {
  id: "ICA-0244",
  crop: L("Palta Hass", "Hass avocado"),
  zone: L("Ocucaje, Ica", "Ocucaje, Ica"),
  areaHa: 5.6,
  campaign: "2026-27",
  receivedDate: "2026-11-04",
  decisionDueDate: "2026-11-21",
  requestedUsd: 40_000,
  tenorDays: 190,
  dueAtMaturityUsd: 42_000,
  tranches: [
    { id: "T1", pct: 30, amountUsd: 12_000, milestone: L("a la firma", "at signing") },
    { id: "T2", pct: 40, amountUsd: 16_000, milestone: L("cuajado verificado", "verified fruit set") },
    { id: "T3", pct: 30, amountUsd: 12_000, milestone: L("pre-cosecha", "pre-harvest") },
  ],
  coverage: 1.85,
  breakEvenPriceUsdKg: 1.05,
  expectedPriceUsdKg: 1.94,
  score: 71,
  tier: "B",
  veto: false,
  scoreDims: [
    { dim: L("Producción", "Production"), weight: 0.5, approval: 74, today: 74 },
    { dim: L("Operador", "Operator"), weight: 0.35, approval: 68, today: 68 },
    { dim: L("Estructura", "Structure"), weight: 0.15, approval: 68, today: 68 },
  ],
  recommendation: "aprobar",
  summary: L(
    "Si se aprueba, se desembolsan USD 12,000 a la firma y hasta USD 40,000 contra hitos verificados; el ingreso esperado de cosecha cubre 1.85 veces los USD 42,000 al vencimiento.",
    "If approved, USD 12,000 is disbursed at signing and up to USD 40,000 against verified milestones; expected harvest revenue covers 1.85 times the USD 42,000 due at maturity.",
  ),
  reasons: [
    L("Huerto de 7 años con vigor 4% sobre lo normal del lote y cosechas verificadas en dos campañas.", "7-year orchard with vigour 4% above the lot's normal and harvests verified in two campaigns."),
    L("Cobertura 1.85x a la solicitud; se mantiene sobre 1.50x si el precio cae 15%.", "Coverage 1.85x at application; stays above 1.50x if the price falls 15%."),
    L("Productor en Normal, título propio sin gravámenes y packing contratado.", "Grower rated Normal, own title with no liens and packhouse contracted."),
  ],
  checks: [
    { group: "Cultivo y volumen", label: L("Vigor del cultivo vs lo normal del lote", "Crop vigour vs the lot's normal"), value: L("+4%", "+4%"), state: "verde", effect: NONE, provenance: "satelital", source: L("Sentinel-2 · 06 nov", "Sentinel-2 · 06 Nov") },
    { group: "Cultivo y volumen", label: L("Agua disponible vs necesidad", "Water available vs need"), value: L("112%", "112%"), state: "verde", effect: NONE, provenance: "satelital", source: L("ERA5 + licencia · 09 nov", "ERA5 + licence · 09 Nov") },
    { group: "Cultivo y volumen", label: L("El Niño costero", "Coastal El Niño"), value: ensoAt(CUTOFF).label, state: "observacion", effect: L("Cobertura -0.10x a -0.20x · estimado", "Coverage -0.10x to -0.20x · estimated"), provenance: "estimado", source: ENSO_SOURCE, real: true },
    { group: "Precio y calidad", label: L("Precio esperado a cosecha", "Expected harvest price"), value: L("USD 1.94/kg", "USD 1.94/kg"), state: "verde", effect: NONE, provenance: "doc_verificado", source: PRICE_SOURCE, real: true },
    { group: "Prestatario", label: L("Clasificación SBS", "SBS rating"), value: L("Normal · 0 protestos", "Normal · 0 protested debts"), state: "verde", effect: NONE, provenance: "doc_verificado", source: L("Central de riesgos · 05 nov", "Credit bureau · 05 Nov") },
    { group: "Prestatario", label: L("Tenencia del predio y gravámenes", "Land tenure and liens"), value: L("Título propio · 0", "Own title · 0"), state: "verde", effect: NONE, provenance: "doc_verificado", source: L("SUNARP · 05 nov", "SUNARP · 05 Nov") },
    { group: "Uso de fondos y cobranza", label: L("Contrato de packing", "Packhouse contract"), value: L("Firmado", "Signed"), state: "verde", effect: NONE, provenance: "doc_verificado", source: L("Contrato · 03 nov", "Contract · 03 Nov") },
  ],
};

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

const LOANS = [ICA_0201, ICA_0188, ICA_0215, PIS_0034, ICA_0142];
/** Portfolio projection: each loan's projected range, weighted by what was disbursed. */
const PROJ = (() => {
  const w = LOANS.reduce((t, l) => t + l.disbursedUsd, 0);
  const at = (k: "low" | "high") => Math.round((LOANS.reduce((t, l) => t + l.disbursedUsd * (l.projection?.[k] ?? l.coverageToday), 0) / w) * 100) / 100;
  return { low: at("low"), high: at("high") };
})();

export const PORTFOLIO: Portfolio = {
  cutoff: CUTOFF,
  applications: [ICA_0177_APP, ICA_0244_APP],
  monthFrom: "2026-10-10",
  engineVersion: ENGINE,
  loans: LOANS,
  changes: [
    {
      loanId: "ICA-0201",
      date: "2026-11-06",
      from: "ambar",
      to: "naranja",
      impact: L("T3 de USD 7,200 congelado. Exposición: USD 16,800.", "T3 of USD 7,200 frozen. The bank's exposure stays at USD 16,800."),
      cause: L("facturas de la fase 2 conciliadas al 68% y fertilización 3 semanas tarde", "phase 2 invoices 68% reconciled and fertilisation 3 weeks late"),
      evidence: { loanId: "ICA-0201", condition: "Facturas de tramos vs presupuesto" },
    },
    {
      loanId: "ICA-0188",
      date: "2026-11-08",
      from: "verde",
      to: "ambar",
      impact: L("Cobertura de 2.10x a 1.75x. Sigue sobre el umbral.", "Coverage from 2.10x to 1.75x. Still above the threshold."),
      cause: L("vigor del cultivo 16% bajo lo normal para el lote: volumen esperado 10% menor", "crop vigour 16% below normal for the lot: expected volume 10% lower"),
      evidence: { loanId: "ICA-0188", condition: "Vigor del cultivo vs lo normal del lote" },
    },
    {
      loanId: "ICA-0215",
      date: "2026-11-03",
      from: "verde",
      to: "ambar",
      impact: L("Capacidad de pago del productor en seguimiento. Cobertura sin cambio (1.60x).", "Grower's repayment capacity under follow-up. Coverage unchanged (1.60x)."),
      cause: L("nueva deuda en el sistema financiero por 24% de la línea (central de riesgos)", "new debt in the financial system of 24% of the line (credit bureau)"),
      evidence: { loanId: "ICA-0215", condition: "Deuda nueva en el sistema" },
    },
    {
      loanId: null,
      date: "2026-11-01",
      from: "neutral",
      to: "observacion",
      impact: L("Cobertura podría bajar 0.10x a 0.20x. Aún no confirmado en campo.", "Coverage could fall 0.10x to 0.20x. Not yet confirmed in the field."),
      cause: L(`El Niño costero de magnitud extraordinaria: el mar frente a la costa estuvo +${OCT_ANOM} °C sobre lo normal en octubre; puede reducir el cuajado de la palta`, `Extraordinary coastal El Niño: the sea off the coast was +${OCT_ANOM} °C above normal in October; it may reduce avocado fruit set`),
      evidence: { loanId: "ICA-0188", condition: "El Niño costero" },
    },
  ],
  exceptions: [
    {
      loanId: "ICA-0201",
      since: "2026-11-06",
      state: "naranja",
      oneLine: L(
        "Las facturas de la fase 2 cubren solo 68% de lo desembolsado y la fertilización se aplicó 3 semanas tarde. TruMarket congeló el T3 de USD 7,200 el mismo día; la exposición del banco queda limitada a USD 16,800. No requiere decisión del banco hoy.",
        "Phase 2 invoices cover only 68% of what was disbursed and fertiliser was applied 3 weeks late. TruMarket froze the T3 of USD 7,200 the same day; the bank's exposure stays limited to USD 16,800. No bank decision required today.",
      ),
      whatHappened: [
        L("Del T2 de USD 9,600, hay facturas conciliadas por USD 6,528 (68%). USD 3,072 sin sustento.", "Of the T2 of USD 9,600, USD 6,528 is reconciled against invoices (68%). USD 3,072 unexplained."),
        L("La fertilización planificada para la semana 12 se observó en la semana 15 (satélite y fotos).", "Fertilisation planned for week 12 was seen in week 15 (satellite and photos)."),
        L("La brecha de facturas (32%) supera la banda naranja acordada (30%); la fertilización 3 semanas tarde supera la banda ámbar (+2 semanas).", "The invoice gap (32%) exceeds the agreed orange band (30%); fertilisation 3 weeks late exceeds the amber band (+2 weeks)."),
      ],
      impact: [
        L("Exposición: USD 16,800 (T1 USD 7,200 + T2 USD 9,600). No se desembolsa más.", "Exposure: USD 16,800 (T1 USD 7,200 + T2 USD 9,600). No further disbursement."),
        L("T3 de USD 7,200 congelado desde el 06 nov.", "T3 of USD 7,200 frozen since 06 Nov."),
        L("Cobertura hoy 1.57x (aprobación 1.65x). Estimado 0.95x a 1.20x si la fertilización tardía no se remedia y El Niño reduce el cuajado.", "Coverage today 1.57x (approval 1.65x). Estimated 0.95x to 1.20x if the late fertilisation is not remedied and El Niño reduces fruit set."),
        L("Cesión de cobros vigente y cuenta de recaudo abierta: el repago sigue canalizado al banco.", "Assignment of receivables in force and collection account open: repayment still flows to the bank."),
      ],
      actions: [
        L("Congeló el T3 de USD 7,200 el 06 nov y lo reportó el mismo día.", "Froze the T3 of USD 7,200 on 06 Nov and reported it the same day."),
        L("Abrió una investigación sobre los USD 3,072 sin sustento.", "Opened an investigation into the USD 3,072 unexplained."),
        L("Pidió al productor un plan de remediación con plazo al 05 dic.", "Asked the grower for a remediation plan due 05 Dec."),
        L("Adelantó el aforo de campo al 20 nov.", "Brought the field estimate forward to 20 Nov."),
      ],
      bankDecision: [
        L("Hoy: nada. El congelamiento es mecánico y ya está ejecutado.", "Today: nothing. The freeze is mechanical and already in place."),
        L("Si la remediación se verifica al 05 dic: TruMarket propondrá liberar el T3 ajustado al aforo, con la conformidad del banco.", "If remediation is verified by 05 Dec: TruMarket will propose releasing the T3 adjusted to the field estimate, with the bank's conformity."),
        L("Si no se verifica: TruMarket le enviará una recomendación escrita de pasar a rojo. Pasar a rojo es decisión del banco.", "If it is not verified: TruMarket will send you a written recommendation to move to red. Moving to red is the bank's decision."),
      ],
      evidence: [
        L("Facturas electrónicas del T2 (04 nov)", "T2 e-invoices (04 Nov)"),
        L("Imagen Sentinel-2 y fotos georreferenciadas (08 nov)", "Sentinel-2 image and geotagged photos (08 Nov)"),
        L("Plan de fase 2 firmado", "Signed phase 2 plan"),
        L("Registro de auditoría del expediente", "File audit log"),
        L("Central de riesgos (15 oct)", "Credit bureau (15 Oct)"),
        L("Estado de la cuenta de recaudo", "Collection account statement"),
      ],
      plan: L("Remediación al 05 dic · aforo 20 nov", "Remediation by 05 Dec · field estimate 20 Nov"),
      ifNotMet: L("Recomendación escrita de pasar a rojo; decide el banco", "Written recommendation to move to red; the bank decides"),
      nextUpdate: "2026-11-20",
    },
  ],
  upcoming: [
    { date: "2026-11-12", loanId: "PIS-0034", milestone: L("Conformidad del T2 por el banco", "Bank conformity for T2"), amountUsd: 11_200 },
    { date: "2026-11-15", loanId: "ICA-0188", milestone: L("Aforo de cuajado · T2", "Fruit-set field estimate · T2"), amountUsd: 14_400 },
    { date: "2026-11-20", loanId: "ICA-0215", milestone: L("Aforo de cuajado · T2", "Fruit-set field estimate · T2"), amountUsd: 12_800 },
    { date: "2026-11-20", loanId: "ICA-0201", milestone: L("Aforo adelantado · T3 congelado", "Field estimate brought forward · T3 frozen"), amountUsd: 7_200 },
    { date: "2026-12-05", loanId: "ICA-0201", milestone: L("Plazo de remediación", "Remediation deadline"), amountUsd: 7_200 },
  ],
  projection: {
    low: PROJ.low,
    high: PROJ.high,
    text: L(
      `Proyección ${PROJ.low.toFixed(2)}x a ${PROJ.high.toFixed(2)}x si El Niño costero reduce el cuajado y la fertilización tardía de ICA-0201 no se remedia. Por confirmar con los aforos de nov y dic.`,
      `Projection ${PROJ.low.toFixed(2)}x to ${PROJ.high.toFixed(2)}x if coastal El Niño reduces fruit set and ICA-0201's late fertilisation is not remedied. To be confirmed by the Nov and Dec field estimates.`,
    ),
  },
  mainPackhousePct: 58,
  controls: { bureauRechecked: [5, 5], assignmentRegistered: [5, 5], insuranceInForce: [5, 5] },
};

export const loanById = (id: string) => PORTFOLIO.loans.find((l) => l.id === id) ?? null;

export const applicationById = (id: string) => PORTFOLIO.applications.find((a) => a.id === id) ?? null;
