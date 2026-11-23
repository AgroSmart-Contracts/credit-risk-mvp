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
    say: "This is a sample portfolio with illustrative data, at the November monthly cut-off. Four things are real: Ica weather, coastal El Niño, export prices from customs declarations, and satellite imagery on some parcels. Up top, four numbers: how much of the bank's money is out, whether the expected harvest covers repayment, what changed, and what needs your decision.",
    coach: "Say 'sample portfolio' once, then move on. Never apologise for it.",
  },
  {
    scene: "2 · Cash calendar",
    secs: 25,
    point: () => [text(L("Calendario de caja", "Cash calendar"))],
    say: "Of a USD 150,000 line, 66,600 is disbursed. The rest is released only against verified milestones and with your conformity. This calendar shows disbursements and repayments by month: exposure peaks before harvest and comes back from March.",
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
    secs: 30,
    point: () => [heading(L("Riesgo de la cartera", "Portfolio risk"))],
    say: "Weighted coverage is 1.80x. Coastal El Niño is at Extraordinary, from real sea temperature data. If it cuts fruit set, and ICA-0201's late fertilisation isn't fixed, we project 1.49 to 1.63x. Every loan carries the El Niño estimate in its own projection. A forecast moves the projection, but never a loan's state: only damage measured in the field does that. The thresholds of 1.50, 1.30 and 1.10 are a proposal we want to agree with you.",
    coach: "If asked where 5 to 10% comes from: a conservative starting assumption, calibrated with the first real campaigns. If asked 'why only under watch?': we don't freeze healthy growers on a forecast; the Nov and Dec field estimates measure the real fruit set.",
  },
  {
    scene: "3 · Changes this month",
    secs: 15,
    point: () => [text(L("magnitud extraordinaria", "Extraordinary coastal El Niño"), false)],
    say: "And this is what changed this month: one loan to orange with a tranche frozen, and the El Niño alert on the whole portfolio.",
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
    say: "On 6 November, phase-2 invoices were only 68% reconciled and fertilisation was 3 weeks late. That same day we froze the T3 tranche of 7,200 and reported it to you. The bank's exposure stays at 16,800, which is only what was already disbursed. No decision is needed today: the remediation plan is due on 5 December.",
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
    secs: 25,
    point: () => [heading(L("Evaluación de riesgo", "Risk assessment"))],
    say: "Coverage today is 1.57x. On coverage alone it would be green, but the state is the most severe of coverage and the triggers, and the invoice gap crossed the orange trigger. The projection, 0.95 to 1.20x, adds the two estimated risks: the late fertilisation if it isn't remedied, and El Niño. That's exactly why T3 is frozen.",
    coach: "If asked why 'due at maturity' is 25,200 with T3 frozen: it's the conservative figure. Without T3 it would be about 17,640, and coverage would be higher.",
  },
  {
    scene: "5 · ICA-0201: evidence",
    secs: 25,
    point: () => [heading(L("Cambios desde la aprobación", "Changes since approval"))],
    click: () => page.locator("tr", { hasText: L("Facturas de tramos vs presupuesto", "Tranche invoices vs budget") }).getByRole("button", { name: /Evidencia|Evidence/ }),
    say: "We monitor 18 conditions; only the ones that affect repayment are shown. Every row opens its evidence: what happened, the threshold, the effect on repayment, the source and the date.",
    coach: "Sources marked 'dato de ejemplo' are illustrative. Say so if asked.",
    after: closeDrawer,
  },
  {
    scene: "5 · ICA-0201: audit log",
    secs: 15,
    point: () => [heading(L("Registro de auditoría", "Audit log"))],
    say: "The audit log is designed as append-only: a correction is a new entry linked to the original, so you always see the history.",
  },
  {
    scene: "6 · Pending decisions: PIS-0034",
    secs: 25,
    click: () => nav(L("Decisiones pendientes", "Pending decisions")),
    point: () => [text("PIS-0034", false)],
    say: "This one does need your conformity: T2 for 11,200. T1 invoices are 99% reconciled, the 7 November field estimate confirms the volume, and coverage is 1.90x. With the price down 20%, it's still 1.52x.",
    coach: "Do NOT click 'Dar conformidad'. If asked about the date: we're showing the November cut-off; live, you'd have 72 hours.",
  },
  {
    scene: "6 · Upcoming",
    secs: 10,
    point: () => [heading(L("Próximas", "Upcoming"))],
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
    point: () => [heading(L("Imagen del predio", "Parcel image"))],
    say: "It declares Hass avocado, but the real satellite history shows a crop that is pruned or rests: vigour drops to 0.26 at its low point every year. Avocado is evergreen. With no verifiable crop there is no coverage to measure. We recommend declining, or a field inspection if the grower disputes it.",
    coach: "Vigour is an index from 0 to 1; a healthy avocado orchard sits around 0.7 to 0.8 all year. Don't click Approve or Decline.",
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
    say: "A 7-year orchard with two verified campaigns, its own title with no liens, and coverage of 1.85x. 12,000 is disbursed at signing and the rest only against milestones.",
    coach: "If they say 1.48x with price -20%: only the 12,000 of T1 is at risk at signing; T2 is sized on the measured fruit set. Offer: no T2 if the projection is below 1.50x.",
  },
  {
    scene: "7 · ICA-0244: stress test",
    secs: 15,
    click: () => button(L("Ver la prueba de estrés completa", "View the full stress test")),
    // The full stress grid opens in place, under the button.
    say: "Every recommendation comes with its stress cases: price and volume, side by side.",
  },
  {
    scene: "8 · Parcel map",
    secs: 15,
    click: () => nav(L("Mapa de predios", "Parcel map")),
    point: () => [page.locator(".leaflet-container")],
    say: "A secondary view: where the money is, by state. On a real file every parcel has a surveyed outline, checked on the field visit before the first tranche.",
  },
  {
    scene: "9 · Assessment memo",
    secs: 15,
    go: url("v=solicitud&id=ICA-0244"),
    click: () => button(L("Memorando de evaluación (PDF)", "Assessment memo (PDF)")),
    point: () => [page.locator(".a4").first()],
    say: "Every file produces a memo for the credit committee: one page for an application, three for a loan.",
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
/** A sidebar item (its accessible name may include a count badge). */
const nav = (s) => page.getByRole("button", { name: new RegExp(`^${s}`) }).first();

async function closeDrawer() {
  await page.keyboard.press("Escape");
  await wait(400);
}

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
    if (s.after) await s.after();
  }
  console.log("\nDone.");
  await browser.close();
  process.exit(0);
})();
