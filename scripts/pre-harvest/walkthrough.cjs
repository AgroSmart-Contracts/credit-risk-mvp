/**
 * Presentation walkthrough for the BCP pre-harvest workspace.
 *
 * Opens a real browser, clicks through the meeting flow page by page, highlights what
 * to point at, and shows the line to say in a panel at the bottom of the screen.
 * A fresh browser profile is used every run, so no earlier test clicks show up.
 *
 * Usage (with the app running, e.g. `npm run dev`):
 *   node scripts/pre-harvest/walkthrough.cjs                 # click "Next" (or press →) to advance
 *   node scripts/pre-harvest/walkthrough.cjs --auto          # advances on its own (rehearsal)
 *   node scripts/pre-harvest/walkthrough.cjs --auto --speed 0.5   # faster rehearsal
 *   node scripts/pre-harvest/walkthrough.cjs --en            # English interface
 *   node scripts/pre-harvest/walkthrough.cjs --url https://<deployment>
 *
 * Needs Playwright (`npx playwright install chromium` once). It never clicks Approve,
 * Decline, Give conformity or Request information: nothing is recorded.
 */
const { chromium } = require("playwright");

const arg = (k) => process.argv.includes(k);
const val = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = val("--url", "http://localhost:5180").replace(/\/$/, "");
const AUTO = arg("--auto");
const SPEED = Number(val("--speed", "1"));
const EN = arg("--en");
const HEADLESS = arg("--headless"); // for checking the script itself
const L = (es, en) => (EN ? en : es);
const url = (q = "") => `${BASE}/?${q}${EN ? `${q ? "&" : ""}lang=en` : ""}#pre-harvest`;

// ---------------------------------------------------------------------------
// The flow: what to show, what to click, what to say (spoken lines in English).
// ---------------------------------------------------------------------------
const STEPS = [
  {
    scene: "1 · Portfolio",
    secs: 25,
    go: url(),
    point: () => [text(L("Cartera de ejemplo · datos ilustrativos", "Example portfolio · illustrative data"))],
    say: "This is a sample portfolio with illustrative data, at the November monthly cut-off. Real data: Ica weather, coastal El Niño, export prices from customs declarations, and one anonymized satellite vigour pattern. Up top, five numbers: the bank's exposure today and at most, coverage today and under a 20% price drop, the loans on the watchlist and why, control of funds, and what is at stake in the next 30 days.",
    coach: "Say 'sample portfolio' once, then move on. Never apologise for it.",
  },
  {
    scene: "2 · Cash calendar",
    click: () => tab("Posición y fondos", "Position and funds"),
    secs: 25,
    point: () => [text(L("Calendario de caja", "Cash calendar"))],
    say: "Of a USD 150,000 line, 66,600 is disbursed. The rest is released only against verified milestones and with your conformity. This calendar shows disbursements and repayments by month on the same basis as coverage: the frozen tranche counted as if released, and each maturity as the full amount due. Exposure peaks before harvest and comes back from March.",
    coach: "If asked about the new applications: they would need a line increase or a second line.",
  },
  {
    scene: "2 · Control of funds",
    secs: 20,
    point: () => [heading(L("Control de fondos", "Control of funds"))],
    say: "All 7 tranches released so far had a complete checklist and your conformity. 93% of the funds have a reconciled invoice, 72% was paid directly to suppliers, zero cash withdrawals, and receivables are assigned on all 5 loans.",
  },
  {
    scene: "3 · Coverage and El Niño",
    click: () => tab("Riesgo", "Risk"),
    secs: 30,
    point: () => [text(L("Estrés de la cartera", "Portfolio stress"))],
    say: "Portfolio coverage is 1.78x: total net revenue over total amounts due, and every loan file shows how its figure is built, from kilos to net revenue. Stress is on net revenue, because packing and freight to port don't fall with the price: a 20% price drop takes the portfolio to 1.27x, a 30% volume drop to 1.24x. Coastal El Niño is at Extraordinary, from real sea temperature data; with it and ICA-0201's late fertilisation we project 1.51 to 1.63x. A forecast moves the projection, never a loan's state. The thresholds of 1.50, 1.30 and 1.10 are a proposal we want to agree with you.",
    coach: "Costs are USD 0.57 per exportable kg, estimated: packing, harvest, transport to port and fees. No ocean freight, because the price is FOB. If asked where 5 to 10% comes from: a conservative starting assumption, calibrated with the first real campaigns.",
  },
  {
    scene: "3 · Watchlist",
    click: () => tab("Resumen", "Summary"),
    secs: 20,
    point: () => [heading(L("En seguimiento", "On the watchlist"))],
    say: "The watchlist says why each loan has its colour. A loan's state is the worse of two signals: its coverage band and its contract controls. ICA-0201 and ICA-0215 are there on a control; their coverage is still in the green band. ICA-0188 is amber on a technical signal, crop vigour, which we're proposing to treat as follow-up only.",
  },
  {
    scene: "4 · Exceptions",
    secs: 15,
    click: () => nav(L("Excepciones", "Exceptions")),
    point: () => [button(L("Abrir expediente", "Open file"))],
    say: "Every orange or red loan opens an exception, issued the same day as the trigger. Let's open the one we have.",
  },
  {
    scene: "5 · ICA-0201: the situation",
    secs: 25,
    click: () => button(L("Abrir expediente", "Open file")),
    point: () => [text(L("congelado", "frozen"), false)],
    say: "On 6 November, phase-2 invoices were only 68% reconciled and fertilisation was 3 weeks late. That same day we froze the T3 tranche of 7,200 and reported it to you. The bank's exposure today is 16,800; at most 25,200 if T3 is ever released, with the estimated cost. No decision is needed today: the remediation plan is due on 5 December.",
  },
  {
    scene: "5 · ICA-0201: tranches",
    secs: 20,
    // The frozen tranche's checklist is open by default.
    point: () => [text(L("Congelado el 06 nov", "Frozen on 06 Nov"), false)],
    say: "T1 and T2 went out with a complete checklist and your conformity. T3 shows exactly what failed: the invoices and the late fertilisation.",
  },
  {
    scene: "5 · ICA-0201: risk",
    click: () => tab("Riesgo", "Risk"),
    secs: 25,
    point: () => [text(L("Cobertura de repago en el tiempo", "Repayment coverage over time"))],
    say: "Coverage today is 1.57x, and you can rebuild it here: 3.4 hectares, about 29 tonnes exportable at 1.94, less costs, is 39,565 of net revenue over 25,200 due. On coverage alone it's green, but the state is the worse of coverage and controls, and the invoice control is orange. The bridge marks use of funds as the driver behind the alert, even though its effect isn't in coverage yet. Break-even is 1.44 a kilo.",
    coach: "If asked why 'due at maturity' is 25,200 with T3 frozen: it's the conservative figure, and the cash calendar uses the same one.",
  },
  {
    scene: "5 · ICA-0201: what affects repayment",
    secs: 20,
    click: () => tab("Riesgo", "Risk"),
    point: () => [heading(L("Cambios desde la aprobación", "Changes since approval"))],
    say: "Here are the conditions that affect repayment on this file: what it was at approval, what it is today, its state and the effect on repayment.",
    coach: "Sources marked 'dato de ejemplo' are illustrative. The full monitoring set and evidence documents open with the pilot.",
  },
  {
    scene: "5 · ICA-0201: audit log",
    click: () => tab("Decisiones e historial", "Decisions and history"),
    secs: 15,
    point: () => [page.locator("main table").first()],
    say: "The audit log is designed as append-only: a correction is a new entry linked to the original, so you always see the history.",
  },
  {
    scene: "6 · Pending decisions: PIS-0034",
    secs: 25,
    click: () => nav(L("Decisiones", "Decisions")),
    point: () => [text("PIS-0034", false)],
    say: "This one does need your conformity: T2 for 11,200. Our checklist is 4 of 4: invoices 99% reconciled, the 7 November field estimate confirms the volume, bureau unchanged. Coverage is 1.90x. With the price down 20% it would be 1.36x, below 1.50, so we propose resizing T3 to the price at its milestone.",
    coach: "This view is read-only until the pilot. If asked about the date: we're showing the November cut-off; live, you'd have 72 hours.",
  },
  {
    scene: "6 · Upcoming",
    secs: 10,
    point: () => [heading(L("Próximos 30 días", "Next 30 days"))],
    say: "And the next 30 days: every milestone and the money it puts at stake.",
  },
  {
    scene: "7 · Application ICA-0177 (veto)",
    secs: 30,
    click: async () => {
      await (await nav(L("Solicitudes", "Applications"))).click();
      await wait(1200);
      return page.locator("tr", { hasText: "ICA-0177" }).first();
    },
    point: () => [page.getByRole("heading", { name: /Imagen del predio|Parcel image|Patrón de vigor|Parcel vigour/ }).first()],
    say: "It declares Hass avocado, but the real satellite history shows a crop that is pruned or rests: vigour drops to 0.26 at its low point every year. Avocado is evergreen. With no verifiable crop there is no coverage to measure. We recommend declining, or a field inspection if the grower disputes it.",
    coach: "Vigour is an index from 0 to 1; a healthy avocado orchard sits around 0.7 to 0.8 all year. Decisions are read-only until the pilot.",
  },
  {
    scene: "7 · Application ICA-0244",
    secs: 25,
    click: async () => {
      await (await nav(L("Solicitudes", "Applications"))).click();
      await wait(1200);
      return page.locator("tr", { hasText: "ICA-0244" }).first();
    },
    point: () => [heading(L("Exposición si se aprueba", "Exposure if approved"))],
    say: "A 7-year orchard with two verified campaigns, its own title with no liens, and coverage of 1.85x. But at 40,000 it fails our standard stress: 1.33x if the price falls 20%, 1.30x if volume falls 30%. So we recommend approving with a 34,000 line, which stays above 1.50 in both cases.",
    coach: "The memo shows both amounts side by side. Whether the 150,000 is a programme limit is still to be confirmed with BCP.",
  },
  {
    scene: "7 · ICA-0244: stress test",
    secs: 15,
    click: () => button(L("Ver la grilla de precio y volumen", "View the price and volume grid")),
    // The full stress grid opens in place, under the button.
    say: "Every recommendation comes with its stress cases: price and volume, side by side.",
  },
  {
    scene: "8 · Parcel map",
    secs: 15,
    click: () => nav("(Mapa de predios|Vista regional|Parcel map|Regional view)"),
    point: () => [page.locator("main")],
    say: "A secondary view: where the money is, by region and state. Exact locations and the parcel map are enabled for pilot files.",
  },
  {
    scene: "9 · Assessment memo",
    secs: 15,
    go: url("v=solicitud&id=ICA-0244"),
    click: () => button(L("Memorando de evaluación (PDF)", "Assessment memo (PDF)")),
    point: () => [page.locator(".a4").first()],
    say: "Every file produces a short A4 memo for the credit committee.",
  },
  {
    scene: "9 · Monthly report and close",
    secs: 30,
    go: url(),
    click: () => button(L("Descargar reporte mensual (PDF)", "Download monthly report (PDF)")),
    point: () => [page.locator(".a4").first()],
    say: "And here's the monthly report you'd receive. To run the first real files, we need to agree on three things today: the thresholds, the 72-hour deadline for your conformity, and this monthly report format.",
    coach: "End on the three agreements. Then stop talking. Expected loss: 'por calibrar', calibrated with the first campaigns.",
  },
];

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------
let page;
let advance = () => {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (s, exact = true) => page.getByText(s, { exact }).first();
const heading = (s) => page.getByRole("heading", { name: s }).first();
const button = (s) => page.getByRole("button", { name: s }).first();
const tab = (es, en) => page.getByRole("tab", { name: new RegExp(`^${L(es, en)}`) }).first();
/** A sidebar item (its accessible name may include a count badge). */
const nav = (s) => page.getByRole("button", { name: new RegExp(`^${s}`) }).first();

async function show(locator) {
  try {
    await locator.waitFor({ state: "visible", timeout: 6000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((el) => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.style.outline = "3px solid #f5a524";
      el.style.outlineOffset = "4px";
      el.style.borderRadius = el.style.borderRadius || "6px";
      setTimeout(() => (el.style.outline = ""), 6000);
    });
  } catch {
    console.warn("  (could not find what to point at; continuing)");
    process.exitCode = 2;
  }
}

async function caption(i, s) {
  await page.evaluate(
    ({ i, n, scene, say, coach, auto }) => {
      let box = document.getElementById("__walk");
      if (!box) {
        box = document.createElement("div");
        box.id = "__walk";
        box.style.cssText =
          "position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;background:#102a40;color:#fff;border-radius:12px;padding:14px 18px;font:15px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);max-height:38vh;overflow:auto";
        document.body.appendChild(box);
        document.body.style.paddingBottom = "40vh";
        window.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight") window.__walkNext?.();
        });
      }
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
          <b style="font-size:13px;letter-spacing:.02em;color:#9fd6bf">STEP ${i + 1} OF ${n} · ${scene}</b>
          ${auto ? "" : '<button id="__walkBtn" style="background:#2fb37a;color:#fff;border:0;border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer">Next ›</button>'}
        </div>
        <div style="font-size:16px">“${say}”</div>
        ${coach ? `<div style="margin-top:8px;font-size:13px;color:#f5c26b">Coach: ${coach}</div>` : ""}`;
      const btn = document.getElementById("__walkBtn");
      if (btn) btn.onclick = () => window.__walkNext?.();
    },
    { i, n: STEPS.length, scene: s.scene, say: s.say, coach: s.coach ?? "", auto: AUTO },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS, args: ["--window-size=1480,1000"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.exposeBinding("__walkNext", () => advance());
  // Terminal: Enter also advances.
  process.stdin.on("data", () => advance());

  console.log(`Walkthrough on ${BASE} · ${STEPS.length} steps · ${AUTO ? `auto (speed ${SPEED})` : "click Next, press → in the browser, or Enter here"}`);
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    console.log(`\n[${i + 1}/${STEPS.length}] ${s.scene}\n  Say: ${s.say}${s.coach ? `\n  Coach: ${s.coach}` : ""}`);
    try {
      if (s.go) {
        await page.goto(s.go);
        await wait(1500);
      }
      if (s.click) {
        const target = await s.click();
        await show(target);
        await wait(500);
        await target.click();
        await wait(1500);
      }
      for (const p of s.point ? s.point() : []) await show(p);
    } catch (err) {
      console.warn(`  (step had a problem: ${err.message.split("\n")[0]}; continuing)`);
    }
    await caption(i, s);
    await new Promise((resolve) => {
      advance = resolve;
      if (AUTO) setTimeout(resolve, s.secs * 1000 * SPEED);
    });
  }
  console.log("\nDone.");
  await browser.close();
  process.exit(0);
})();
