# Pre-harvest loan file: redesign implementation brief

Use this file to implement the redesign. It is based on:

- a review of the live app at `/?lang=en&week=24&scenario=weather_shock&deal=PH-ICA-0142-2526#pre-harvest`;
- research on Rixkia (rixkia.com/dashboard), a Peru early-warning dashboard;
- the original design brief.

## Ground rules

- **User:** a BCP credit analyst. Write the UI like a banking product. Never use the words "demo", "mock" or "simulation".
- **Stack:** React 19, Vite, TypeScript, Tailwind v4 tokens (`tm-black`, `tm-surface`, `tm-neutral`, `tm-border`, `tm-primary`, `tm-accent`, `tm-danger`, `font-display`), Recharts, Leaflet with Esri World Imagery, framer-motion, lucide-react.
- **Colours:** use the tokens only. Replace every hard-coded hex value.
- **Language:** everything is bilingual (EN/ES) and must work at 375 px width and in print (credit memo) mode.
- **Severity names:** green = **Normal**, amber = **Watch**, red = **High risk**. Do not use the word "Yellow" anywhere in the UI.

---

## 0. Bugs to fix first (seen at week 24)

1. **Blank header image.** The parcel image in the header card renders as a grey placeholder with only the outline. Load the Sentinel-2 or Esri image for the replay date. If it is missing, fall back to the latest available scene and label it with its date.
2. **Contradictory status.** The header shows "Closed campaign" on 23 Feb 2026 while the purchase order is not yet signed and the status is "Follow-up". Derive campaign status from the replay date: Active before M3, Closed after it.
3. **Decision card has no actions.** It only shows a sentence. Build the full card (see §3): the decision, condition chips, the recommendation, and Hold / Inspect / Approve buttons. When there is nothing to decide, show "No decision due · next checkpoint: <milestone, date>".
4. **"8.5% TEA" on the English view.** Show "8.5% effective annual" in EN and "TEA 8.5%" in ES.
5. **Empty chart space after today.** Charts extend to April with nothing after today. Either fill it with the forecast band (§5) or end the axis at today.
6. **Week label mismatch.** "Week 24/26" disagrees with the slider range of 15 Sept–9 Mar. Use one source of truth for the total number of weeks.
7. **Severity labels.** Rename "Yellow" to "Watch" in chips and legends, and use `tm-accent`.
8. **Inconsistent date formats.** "15 Sept" sits next to "17 Nov". Use date-fns with the `en-GB` and `es` locales.

---

## 1. Packages

### Install

```
npm i react-leaflet leaflet-side-by-side @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-tooltip vaul date-fns
```

| Package | Use | Why the current stack isn't enough |
|---|---|---|
| react-leaflet | Declarative map, layers and polygons | Imperative Leaflet calls are awkward inside React 19 effects |
| leaflet-side-by-side | Before/after swipe (true colour vs NDVI, or date A vs date B) | Leaflet has no swipe control built in |
| @radix-ui/react-dialog, react-popover, react-tooltip | Accessible sheets, popovers and chart tooltips | framer-motion animates but has no focus trapping or ARIA |
| vaul | Mobile bottom sheet for explanations and the context strip | Drag-to-dismiss with snap points is hard to get right yourself |
| date-fns (+ `es` locale) | Week and date formatting in both languages | Avoids hand-rolled date logic |

### Use what you already have

- **Recharts:** `<Area>` for forecast bands, `<ReferenceLine>` for the today line, `<ReferenceArea>` for threshold zones and the flowering window.
- **framer-motion:** `AnimatePresence`, `layout`, `useSpring`, `useTransform`.
- **lucide-react:** all icons.

### Only if needed later

- **@visx/shape or d3-shape:** fan charts with three or more percentile bands, where Recharts gets messy.
- **maplibre-gl:** smooth satellite time-lapse with tile cross-fades. Rixkia uses MapLibre 6.15 with PMTiles. Leaflet can step between dates but cannot cross-fade smoothly.

### Do not add

MUI, Chakra, ECharts or Highcharts. They conflict with the Tailwind tokens, and Highcharts needs a paid licence for commercial use.

### Data sources

Rixkia has a **documented API** (rixkia.com/desarrolladores):

- **Access:** a free account verified by email, with a Bearer token from `POST /api/v1/auth/login`.
- **Scope:** 188 read routes, with an OpenAPI file to download.
- **Limits:** 120 requests per minute.
- **Live updates:** SSE and a WebSocket.

It is useful for El Niño status, official notices and hazard layers. Before relying on it in production, check its terms of use and its uptime: several routes returned 503 during the review. Otherwise, go to the original public sources:

| Need | Source |
|---|---|
| Weather (observed and forecast) | Open-Meteo, including the forecast and seasonal APIs |
| El Niño | NOAA CPC, and the ENFEN ICEN index published by IGP |
| Official weather alerts | SENAMHI |
| Fire hotspots | NASA FIRMS |
| River levels | ANA (Peru's national water authority) |
| Satellite imagery | Sentinel-2 (already in use) |

---

## 2. Top 10 recommendations, ranked by impact

### 1. Decision-first hierarchy
- **What:** the decision card becomes the hero of the page. The four headline numbers shrink to one compact row, and the timeline becomes a slim strip.
- **Applies to:** the top section of the loan file.
- **Reference:** Stripe Dashboard and Linear issue view, which put one primary action and its status first.
- **How to build:**
  - Decision card: `border-2 border-tm-primary`, a shadow, and an `font-display` title.
  - The other cards: `border-tm-border` with no shadow.
  - Headline row: `grid-cols-4` on desktop and `grid-cols-2` on mobile, each cell about 88 px tall.
- **Effort:** S.

### 2. One timeline for past, today and forecast
- **What:** the replay slider runs from approval to maturity. The past is solid, the future is hatched, a "Today" marker sits on the current date, and a "Back to today" chip appears whenever the slider is moved away from today.
- **Applies to:** the replay bar and all Monitoring charts.
- **Reference:** Rixkia's timeline (−72 h … Now … +7 d, with "In 3 days" and "Back to now").
- **How to build:**
  - Use `<input type=range>` styled with Tailwind.
  - Draw the future part of the track with a CSS `repeating-linear-gradient`.
  - Read and write `week` and `mode=forecast` in URL params.
- **Effort:** M.

### 3. Forecast bands on every chart
- **What:** each chart shows observed data up to today, then a dashed median line and a P10–P90 band through to harvest (see §5).
- **Applies to:** the Crop, Weather and Market charts in Monitoring.
- **Reference:** Meteoblue's meteograms (uncertainty shading) and NOAA's ENSO plume.
- **How to build:**
  - In Recharts, stack two `<Area>` series to draw the band: `[p10, p90-p10]` with `stackId="band"`, the first series with `fill="transparent"`.
  - Draw the median with `<Line strokeDasharray="4 4">`.
  - Add `<ReferenceLine x={today} label="Today">`.
- **Effort:** M.

### 4. Context strip
- **What:** a single line under the header showing El Niño status, the price against its band, and water coverage. Each item has a trend arrow, and clicking an item opens a sheet with the explanation, the source and a mini chart.
- **Applies to:** the top of the loan file.
- **Reference:** Rixkia's El Niño banner ("+4.3 °C Extraordinary ▲ +1.4 in 3 months", which opens a sheet with the ICEN official-vs-model explanation).
- **How to build:** a flex row of buttons. Use a Radix Dialog on desktop and a vaul Drawer on mobile.
- **Effort:** S.

### 5. Monitoring overview and severity filter
- **What:** a summary row of five mini cards at the top of the Monitoring tab, each with an icon, its severity and a one-line conclusion. Clicking a card scrolls to its panel. Add a chip, "Only Watch and above · Show all", that collapses Normal panels to a single line.
- **Applies to:** the Monitoring tab.
- **Reference:** Rixkia's severity filter chip.
- **How to build:**
  - Use `IntersectionObserver` for a sticky in-page navigation that highlights the panel in view.
  - Collapse panels with framer-motion `layout` and `AnimatePresence`.
- **Effort:** M.

### 6. Threshold zones instead of dashed lines
- **What:** shade the Watch and High-risk value ranges as faint filled zones, and show the line in the tooltip only.
- **Applies to:** all Monitoring charts.
- **Reference:** Rixkia's single legend ("Colour = level · Shape = hazard") and Our World in Data charts.
- **How to build:**
  - Use `<ReferenceArea y1 y2 fill="var(--color-tm-accent)" fillOpacity={0.08}>`.
  - Show one shared legend at the top of the Monitoring tab instead of a legend per chart.
- **Effort:** S.

### 7. Satellite layers, swipe and time-lapse
- **What:**
  - One Leaflet map with layers for true colour, NDVI and weak patches.
  - A before/after swipe between two dates.
  - Clicking a chip in the scene-date strip switches the image.
  - A play button runs a time-lapse.
- **Applies to:** the Monitoring Satellite card and the Summary field map.
- **Reference:** Sentinel Hub EO Browser (date strip and compare), the Google Earth Engine timelapse, and Rixkia's layers panel.
- **How to build:** react-leaflet `<ImageOverlay>` for each scene, cross-faded by animating the opacity of the overlays, plus leaflet-side-by-side for the swipe.
- **Effort:** M–L.

### 8. Rich, consistent tooltips
- **What:** a single tooltip component for every chart showing the date, the value, the delta vs the 5-year median, the severity chip and the source.
- **Applies to:** all charts.
- **Reference:** Robinhood and Stripe chart tooltips.
- **How to build:** `<Tooltip content={<TmTooltip/>} cursor={{ stroke: 'var(--color-tm-border)' }}>`.
- **Effort:** S.

### 9. Explain every number
- **What:** an ⓘ next to the score, the coverage figure and each signal opens a popover with how the number is calculated, what moved it, the source and how recent the data is. Where both exist, show the official figure next to the model figure.
- **Applies to:** the headline numbers and Credit analysis.
- **Reference:** Rixkia's El Niño sheet.
- **How to build:** Radix Popover.
- **Effort:** S.

### 10. Remove duplication and tidy the tabs
- **What:**
  - Keep the facility terms (loan-to-value, rate, amount) on Summary only. Credit analysis keeps the scoring.
  - Drop the price × yield stress grid, or move it behind a "Stress test" disclosure.
  - Shorten the tab labels: Summary · Monitoring · Analysis · History · Disbursements · Application.
- **Effort:** S.

---

## 3. Layout proposal for the loan file

### Desktop (≥ 1024 px)

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────┐
│ BCP›    │ Pre-harvest loans › ICA-0142                       🔔  MR ▾  │
│ powered ├──────────────────────────────────────────────────────────────┤
│ by      │ [sat img] ● Active · 2025-26 · Day 147/180                     │
│ TruMkt  │           Client ICA-0142 · Hass avocado    [Memo] [EN|ES]     │
│         │           Villacurí, Ica · 9.24 ha decl · 9.28 measured        │
│ Inbox   │           Data as of 23 Feb · Sentinel-2 · ERA5 · NOAA         │
│ Files ● ├──────────────────────────────────────────────────────────────┤
│ Alerts 5│ El Niño neutral −0.3 ▸ │ FOB $2.21 in band ▸ │ Water 99% ⚠ ▸    │  context strip
│ Reports ├──────────────────────────────────────────────────────────────┤
│         │ ▶ ━━━━━━━━━━━━━━━━━━●┄┄┄┄┄┄┄┄  Wk 24 · 23 Feb  [Back to today] │  replay bar
│ Book    │   Sep   Nov   Jan  Today   Mar(harvest)                        │
│ $4.2M   │   news this week: 2 ▸                                          │
│ 7 watch ├══════════════════════════════════════════════════════════════┤
│ 1 risk  ║ DECISION · due 13 Feb   Release T3 · USD 21,000 (30%)         ║  hero
│         ║ ✓Sat in band  ✓Harvest 91%  ✓Sale agmt  ✓Coverage 1.65×        ║
│         ║ 💡 Approve with field inspection    [Hold][Inspect][Approve]   ║
│         ╠══════════════════════════════════════════════════════════════╣
│         │ 64·C ▼3 ▬▬●▬ │ Exposure 49k/70k ▬▬ │ Repay 14 Mar · 33 d │ ⚠Water │  KPI row
│         │ ✓Approval ─ ✓Fruit set ─ ◉Pre-harvest ┄ ○Harvest·PO ┄ ○Maturity│  slim timeline
│         ├──────────────────────────────────────────────────────────────┤
│         │ Summary | Monitoring● | Analysis | History 2 | Disb. | App      │
│         │ ┌ Overview: [Sat ✓][Crop ✓][Weather ⚠][Market ✓][Repay ✓]   ┐ │
│         │ │ [Only Watch+ ✕]                                             │ │
│         │ │ Weather ⚠  Climate risk elevated → Call inspection          │ │
│         │ │ ┌ chart: observed ━━━ | today | ┄┄ median + band ░░ ┐       │ │
│         │ └──────────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────────┘
```

### Mobile (375 px)

```
┌─────────────────────────────┐
│ ‹ Files   ICA-0142     🔔 MR │
├─────────────────────────────┤
│ [satellite image, full width]│
│ ● Active · Day 147/180       │
│ Client ICA-0142 · Hass avoc. │
│ Villacurí · 9.24 ha          │
├─────────────────────────────┤
│ El Niño ▸ | FOB ▸ | Water ⚠ ▸│  ← horizontal scroll
├─────────────────────────────┤
│ ▶ ━━━━━━●┄┄┄  Wk 24 · 23 Feb │
╞═════════════════════════════╡
║ DECISION · due 13 Feb        ║
║ Release T3 · USD 21,000      ║
║ ✓ ✓ ✓ ✓  4/4 conditions ▾    ║
║ 💡 Approve + inspection      ║
║ [Hold] [Inspect] [Approve]   ║  ← sticky bottom bar while card off-screen
╞═════════════════════════════╡
│ 64·C ▼3     │ 49k / 70k     │
│ 14 Mar·33d  │ ⚠ Water 99%   │
├─────────────────────────────┤
│ ✓─✓─◉┄○┄○  Pre-harvest      │
├─────────────────────────────┤
│ Summary Monitoring Analysis ›│  ← scrollable tabs
│ ...                          │
└─────────────────────────────┘
```

**Mobile rule:** when the decision card scrolls out of view, show a sticky bottom bar reading "Release T3 · USD 21,000 [Review]".

---

## 4. Motion spec (framer-motion)

**Global rules:**
- Respect `useReducedMotion()`. When it is on, drop every motion to an opacity change only, or no motion at all.
- Default easing is `[0.22, 1, 0.36, 1]` (easeOutQuint).
- Never animate continuously, never bounce, and never pulse anything except a red alert, which may pulse once.

| Motion | Trigger | Spec |
|---|---|---|
| **Replay week change** | Slider or play advances one week | The page container does **not** remount. Numbers count (see below), charts extend (see below). The date label cross-fades: `AnimatePresence mode="popLayout"`, exit `{opacity:0,y:-6}`, enter `{opacity:0,y:6}→{opacity:1,y:0}`, 180 ms. Autoplay step: **900 ms** per week (currently 600 ms). Pause automatically when a severity changes and resume after 1.2 s. |
| **Card entry** | First load or tab mount | `initial {opacity:0,y:8}` → `{opacity:1,y:0}`, 240 ms, stagger 40 ms per card via `staggerChildren`. Only on first mount, never on replay steps. |
| **Number change** | Any KPI value changes | `useSpring(value,{stiffness:120,damping:20})` + `useTransform` to the formatted string. About 400 ms. Show a delta chip ("▼3") that fades in for 1.5 s, then fades to 60% opacity. Use tabular figures (`font-variant-numeric: tabular-nums`). |
| **Chart update** | Replay week advances | Add the new point(s) only. Animate the line from the previous end point to the new one: Recharts `isAnimationActive`, `animationDuration={400}`, `animationEasing="ease-out"`, with a stable `dataKey` and no `key` change on the chart. Move the Today `ReferenceLine` x with a 400 ms CSS transition on a custom label. The forecast band fades in over 300 ms after the line finishes. |
| **Tab switch** | Clicking a tab | Underline uses `layoutId="tab-underline"` (spring, stiffness 400, damping 35). Content: exit opacity 0 over 120 ms, enter opacity 0→1 and x 8→0 over 200 ms. Keep the scroll position for each tab. |
| **Severity change** | A panel's severity moves up or down | The chip colour animates over 300 ms. Escalation: one ring pulse (`boxShadow` 0 → `0 0 0 6px` token/30% → 0) over 600 ms, **once**. The headline Signals cell flashes its background `tm-accent/10` for 800 ms. De-escalation: colour change only, no pulse. Log the change in History. |
| **Sheets and dialogs** | Context strip, ⓘ | Desktop dialog: scale 0.98→1 with fade, 180 ms. Mobile: vaul default spring. |
| **Skeleton loading** | Data fetch longer than 150 ms | `tm-neutral` blocks with a 1.2 s shimmer, matching final layout sizes. Never use a spinner inside a card. |
| **Collapse to one line** | Severity filter on | framer `layout` on the panel, height animated over 250 ms, content `AnimatePresence`. |

---

## 5. Forecast view

**Shared rules:**
- Observed data: a solid line in `tm-primary`.
- Expected path: a dashed median and a P10–P90 band in `tm-neutral` at 15% opacity.
- A vertical **Today** line in `tm-black`, labelled "Today · 23 Feb".
- A **Harvest** marker at the planned M3 date.
- The x-axis ends at maturity.
- Each chart has a caption above it: "Outlook to harvest: <conclusion> · <confidence>".

1. **Crop (NDVI)**
   - **Expected path:** the parcel's 5-year median curve, shifted by the current anomaly and decaying to zero anomaly over 4 weeks.
   - **Band:** the 5-year P10–P90 range for each date.
   - **Caption:** "Expected yield 97% of declared (range 90–103%)".
   - **Thresholds:** shaded zones at −15% (Watch) and −25% (High risk).
2. **Weather**
   - **Temperature:** the Open-Meteo 16-day forecast, then the seasonal or climatology band to harvest. Keep the flowering window shaded with `ReferenceArea`.
   - **El Niño:** an NOAA plume showing the median and the range of models. Add a chip with the latest ENFEN ICEN official classification next to it.
   - **Water coverage:** the projected ratio = licensed volume ÷ (crop coefficient × forecast evapotranspiration). Shade the region below 100%.
3. **Market (FOB USD/kg)**
   - **Observed:** monthly points.
   - **Expected path:** the seasonal median, with P25 and P10 bands to the harvest month.
   - **Break-even:** a horizontal `ReferenceLine` at $1.01 labelled "Break-even".
   - **Caption:** "Headroom 40% at expected price; 1-in-10 low price still covers 1.2×".
4. **Harvest repayment card**
   - **Coverage bar:** expected coverage (1.65×) as a solid marker, the P10–P90 range as a band, and a 1.0× line.
   - **Checklist:** purchase order, credit insurance and the advance, each with an expected date. Overdue items turn Watch-amber.
   - **Sentence:** "If the PO is signed by 1 Mar, repayment on 14 Mar is covered 1.65× (range 1.2–2.0×)."

---

## 6. Things to avoid

- Pulsing "REAL TIME" or "LIVE" badges. The data is weekly, so the badge would be misleading.
- A dark, map-first layout or crowded marker clusters. They suit early-warning monitoring, but a credit file should lead with the decision.
- Decorative leaves, stock farm photos, avocado illustrations and "AI-powered" taglines. They read as marketing and lower trust.
- Gradient score gauges without a stated direction. Always say "higher = safer".
- Confetti, bouncing or springy overshoot on money figures.
- Hiding the data source or how recent it is. Every chart must show its source and "as of" date.
- Forecast lines with no uncertainty band. An unqualified forecast reads as a promise.
- "Clear the screen" or "Map only" toggles. They add clutter for an analyst.
- Using red for anything other than High risk or Stop.

---

## 7. Acceptance checklist

- [ ] No hard-coded colours (`grep -E "#[0-9a-fA-F]{3,6}" src` returns only the token definitions).
- [ ] The words "demo", "mock" and "simulation" appear nowhere in the UI strings (EN and ES).
- [ ] Campaign status, the week label and the slider range agree for every week of the replay.
- [ ] The decision card always shows a decision with actions, or "No decision due · next checkpoint".
- [ ] Every chart has a Today line, forecast data to harvest, a source and an "as of" date.
- [ ] `prefers-reduced-motion` disables count-ups, line drawing and pulses.
- [ ] The page works at 375 px with a sticky decision bar.
- [ ] Credit memo print mode hides the replay bar, tabs and buttons, and expands all panels.

---

## 8. Reference analysis: Rixkia (rixkia.com/dashboard)

Rixkia is a Peruvian multi-hazard early-warning product covering earthquakes, river floods, wildfires, debris flows, coastal swell and volcanoes. It is useful as a reference because it solves the same problem TruMarket has: turning official and satellite data from Peru (SENAMHI, IGP, ENFEN, NOAA, Sentinel) into a status, a reason and an action, in both EN and ES. This section reviews the whole product, component by component, and for each one says:

- what it is;
- why its placement works (or doesn't);
- what TruMarket should take from it.

Pages reviewed (every sidebar item):

- **MONITORING:** Live map, How it works, Reports, Alerts, and under My surroundings: Risk by location, Transport route, Portfolio.
- **HAZARDS:** Seismic and Wildfires opened. Floods, Debris flows, Coast and Volcanoes use the same module template; their URLs were confirmed but the pages were not opened one by one. Also Simulations, A point, Forecast.
- **RECORD:** Forecast by zone, History, Exercise, Performance.
- **Other:** The API, Rixkia AI, My account.
- **Panels:** the El Niño detail sheet, the alerts side panel and a map-marker popup.

The mobile layout and dark mode were not tested.

Sidebar map, with the matching section of this report:

| Group | Item | Route | Section |
|---|---|---|---|
| Monitoring | Live map | /dashboard | 8.3 |
| Monitoring | How it works | /dashboard/metodo | 8.9 |
| Monitoring | Reports | /dashboard/informes | 8.5 |
| Monitoring | Alerts | /dashboard/alerts | 8.4 |
| My surroundings | Risk by location | /dashboard/territorio | 8.6 |
| My surroundings | Transport route | /dashboard/ruta | 8.7 |
| My surroundings | Portfolio | /dashboard/cartera | 8.8 |
| Hazards | Seismic, Floods, Wildfires, Debris flows, Coast, Volcanoes | /dashboard/seismic, flood, fire, huaicos, costa, volcanes | 8.12 |
| Hazards | Simulations | /dashboard/simulaciones | 8.13 |
| Hazards | A point | /dashboard/punto | 8.14 |
| Hazards | Forecast | /dashboard/pronostico | 8.15 |
| Record | Forecast by zone | /dashboard/predictions | 8.16 |
| Record | History | /dashboard/history | 8.17 |
| Record | Exercise | /dashboard/ejercicio | 8.18 |
| Record | Performance | /dashboard/desempeno | 8.19 |
| Other | The API | /desarrolladores | 8.20 |
| Other | Rixkia AI | /dashboard/chat | 8.21 |
| Other | My account | /dashboard/cuenta | 8.22 |

**On the sidebar itself:**
- The three group labels (MONITORING / HAZARDS / RECORD) separate **now**, **what could happen** and **what happened and how well we did**. That is a clean mental model.
- With more than 20 items, the sidebar scrolls and items are hidden below the fold. Pages like Performance and Exercise, which are among the product's strongest, are easy to miss.

**Take for TruMarket:**
- Same three-way grouping, under 8 items:
  - **Files:** Inbox, Decisions, Alerts.
  - **Outlook:** Portfolio risk, Forecast.
  - **Record:** History, Model performance, Method & sources.
- Keep everything visible without scrolling.

### 8.1 Technical stack (from network traffic)

| Layer | What they use | Note for TruMarket |
|---|---|---|
| Framework | Next.js (App Router, Turbopack, React Server Components) | No change needed; Vite and React 19 are fine |
| Map | MapLibre GL 6.15, PMTiles vector basemap of Peru served from their own API, Esri Light Gray Canvas tiles | MapLibre gives smooth zoom and cross-fades; consider it only for the satellite time-lapse |
| Fonts | Inter for body text, Space Grotesk for headings and numbers | The equivalent of our `font-display`; a geometric sans reads as "data product", a serif as "bank / editorial" |
| Data | `/api/v1/*`, **publicly documented** at /desarrolladores (OpenAPI, 188 read routes, token from a free verified account, 120 req/min, SSE and WebSocket) | Usable as a data source once the terms are checked (see §1). Several endpoints returned 503 during the review, so add a fallback to the original sources |
| Analytics | Google Analytics 4 | n/a |

### 8.2 Global shell (present on every page)

| Component | Where | What it does well | Weakness | Take for TruMarket |
|---|---|---|---|---|
| **Dark left sidebar** with logo and the subtitle "PERU · EARLY WARNING" | Fixed left, 260 px | The product's scope is stated under the logo, so the user always knows where they are. Nav is grouped under a "MONITORING" heading, and a "My surroundings" group expands to sub-pages (Risk by location, Transport route, Portfolio) | Dark and heavy; it pulls attention away from content. The sidebar is long, so the account block covers nav items on short screens | Copy the **subtitle under the logo** ("Agro credit monitoring · powered by TruMarket") and the **grouped nav**. Keep our light sidebar |
| **Count badge on nav items** (Alerts **20** in red) | Next to the nav label | The first thing an analyst wants to know (how much needs me?) is visible from any page | Red is used for the total count, not just red alerts, so the colour is overused | Add "Decisions 3" and "Alerts 5" badges, coloured by the **worst** severity inside, not by the count |
| **"How it works" nav item, outlined** | Second item, permanently highlighted with an outline | Trust is built into the product: method, sources and limits are one click away from anywhere | The permanent outline looks like a selected state and confuses navigation | Add a "Method & sources" page (scoring model, thresholds, data sources and how recent each one is, limits). Banks need this for model validation. Style it as a normal nav item |
| **Account, theme and language block** at the bottom of the sidebar | Bottom left | Light/dark/system theme, ES/EN and account are grouped in one predictable place | Takes space; theme is rarely changed | Put language and account there. Skip the theme switch for v1 |
| **Footer note:** "Official notices from SENAMHI and the IGP are quoted in Spanish: that is how they publish them." | Sidebar bottom | Honest: it explains why some text isn't translated, before the user files a bug | Small grey text that is easy to miss | Add the same note in EN mode for registry and SUNAT text, and for news quoted in Spanish |
| **"● LIVE — PERU · v0.1.0 · Official and satellite data"** | Sidebar bottom | Shows the version and data provenance, which is good for audit | "LIVE" with a pulsing dot is wrong for weekly data | Show "Data as of <date> · model v0.1" instead. Never "LIVE" |
| **Top utility bar:** Back, breadcrumb, Save view, Search (Ctrl K), Clear the screen | Top of each content page | A breadcrumb plus an explicit **Back** keeps orientation in deep pages. **Ctrl K** search is a power-user feature | "Clear the screen" is unclear and adds clutter | Add the breadcrumb, Back, and **Ctrl K search across files** (client, parcel, campaign). Skip "Save view" and "Clear the screen" for now |
| **"What is this and what is it for? ›" button** | Next to every page title | Each page explains itself, which helps first-time users (BCP analysts new to NDVI or M3 will be first-time users) | On the Live map it's a big round bubble that breaks the header layout | A small "ⓘ About this page" link next to each title, opening a sheet. One consistent style |

### 8.3 Live map (home page)

Overall layout, from top to bottom:

- page title and freshness;
- a context ticker (El Niño);
- a headline-number strip;
- the timeline;
- place search;
- the full-width map, with the layers panel on the left, the alerts list on the right, and the legend bar at the bottom.

**What works:** the order goes from the national picture to the timeframe, then to a place, then to detail.

**What doesn't:** six stacked bands sit above the map, so on a 724 px-tall viewport the map only starts at y≈325, almost half the screen down.

| # | Component | Placement | Why it's good there | Weakness | Take for TruMarket |
|---|---|---|---|---|---|
| 1 | **Title "Live map — Peru" + "REAL TIME" + "Updated 2:50:41 PM · Official and satellite data"** | Top left | Freshness and source sit right under the title, which answers "can I trust this?" before anything else | The time is down to the second, which is false precision; "REAL TIME" is a marketing word | Header: "Data as of 23 Feb 2026 · Sentinel-2 · ERA5 · NOAA". We already do this, so keep it |
| 2 | **Refresh / Map only buttons** | Top right of the header | Primary utilities, close to the freshness label they affect | "Map only" and "Clear the screen" are two ways of saying the same thing | Keep Refresh next to "Data as of" only for open files |
| 3 | **Context ticker:** "Coastal El Niño +4.3 °C Extraordinary ▲ +1.4 in 3 months · official ICEN +4.50 · extraordinary … high risk on the n… ›" | A full-width strip under the header | **The best component in the product.** The single most important external driver is always visible, as one line: the value, the category (in colour), the trend with an arrow and period, and the **official** figure next to their own. It sits above everything, because it affects everything. Clicking opens a detail sheet (8.3.a) | The text is truncated with "…", and the strip mixes three messages | Build our **context strip** (§2, recommendation 4) with three items (El Niño, FOB price vs band, water coverage), each a single message, none truncated |
| 4 | **Headline-number strip:** 20 active alerts · 1 red / 101 wildfires · 430 hotspots / 16 quakes (72 h) / 5 rivers on alert / 6.0 max magnitude / CRITICAL overall status | Under the ticker, a 3-column grid | Each cell is icon + big number + qualifier + label, and the **qualifier carries the severity** ("1 red" in red, "430 hotspots" in orange) while the main number stays neutral. **Overall status** is the last cell, giving the overall verdict | Six cells of equal weight, so the eye doesn't know where to land. "CRITICAL" should lead, not trail | Our KPI row: **neutral main number, coloured qualifier** ("64 · C" in black, "▼3 since approval" in amber). Put the **verdict first** (the decision card), then the numbers |
| 5 | **Timeline slider:** −72 h · −24 h · **Now** · +1 d · +3 d · +7 d, with a readout "Now" / "In 3 days" and a "Back to now" button | A full-width row under the headline numbers | Past and forecast share **one control**, with "Now" as the centre. Preset chips make it one click to jump to common horizons. The readout switches to relative wording ("In 3 days"), and a recovery button appears only when you've left "Now" | The slider and the chips do the same job; the readout repeats the selected chip | The replay bar becomes a past-today-forecast slider with chips: **Approval · Fruit set · Today · Harvest · Maturity**. "Back to today" appears only when the slider is away from today (§2, recommendation 2) |
| 6 | **"View a zone" + place search** ("Address or place · Department, province or district") | Above the map | Search sits in the map's own frame, so it's clear it moves the map | n/a | For the Inbox: a search field for "Client, parcel, district" above the file table |
| 7 | **Layers panel** (collapsible, left over the map): Sea and El Niño (None / Anomaly / Temp.), then "Real-time data" with Issued alerts 3, Seismicity 1, Wildfires 0… | Floating on the left side of the map | Layers are grouped by theme, each with a **count**, so you know before toggling whether it has anything. A segmented control picks the variant inside a group. It collapses to a slim tab | It covers about a third of the map on small screens | The satellite card's layers: **True colour / NDVI / Weak patches / Neighbouring parcels**, with a value next to each ("NDVI 0.67", "weak 6%") |
| 8 | **Severity filter chip:** "● Only orange alerts or more severe · Show all · ✕" | Floating at the top centre of the map | The **default view is filtered to what matters**, and the chip is honest that a filter is on, with a one-click way out. It reduces noise without hiding anything | It sometimes covers map content | The Monitoring tab default: "Only Watch and above · Show all". Normal panels collapse to one line (§2, recommendation 5) |
| 9 | **Alerts side panel:** "Orange or more severe 1–2 of 3 · LIVE", a Show dropdown, cards (icon, title, RED / Seismic chips, "8 h ago · expires in 15 h", Full ↗), and pagination | The right edge, sliding over the map | Each card gives **severity, type, age and expiry**, and "expires in 15 h" is a great idea: alerts have a lifespan. The list and the map are linked | Pagination for 3 items is unnecessary. "LIVE" again | Alerts in "What happened": each with severity, panel, **raised N days ago**, and **"re-check by <date>"** (expiry = the next satellite or weather update) |
| 10 | **Map popup** (click a marker): category header "SWELL AND COAST", title, a coloured risk band "Elevated risk", then Zone and Notice (the official text) | Anchored to the marker | Category, then title, then **a severity band across the full width**, then the evidence. You read severity before detail. The official notice is quoted, not paraphrased | The popup is long and covers the list | Our condition chips and alerts: severity band first, then the claim, then the **evidence quoted from the source** (for example the SENAMHI notice text) |
| 11 | **Legend bar:** "Colour = level ● Red ● Orange ● Yellow ● Green · Shape = hazard [icons] · Lightning, last hour: 1,536" | Floating at the bottom of the map | **A single legend explains the whole encoding**: colour is one dimension, shape is another. Users learn it once | It also carries a live stat (lightning count), which mixes legend and data | A single legend at the top of the Monitoring tab: "Colour = severity (Normal / Watch / High risk) · Line = observed, dashed = expected, band = range" |
| 12 | **Map controls:** zoom, locate, download (PNG), scale bar "500 km" | Bottom right of the map | Standard placement; the download button is useful for reports | n/a | Add "Download image" to the satellite card for the credit memo |

#### 8.3.a El Niño detail sheet (opened from the ticker)

- **Contents, in order:**
  - The headline value **+4.31 °C above normal** in large red type.
  - "Extraordinary · rising +1.4 °C in 3 months".
  - A plain-language comparison: "Comparable to 1982-83, 1997-98 and 2017…".
  - A boxed section, "Peru's official index: the ENFEN ICEN", showing **+4.50 extraordinary warm · Sep 2026** with the monthly series (Apr +1.34 … Sep +4.50).
  - Two paragraphs explaining **why the official number differs** from theirs (a different climatology and a 3-month mean).
  - "Source: IGP, for ENFEN".
  - A bar chart.
- **Why it's excellent:**
  - It anticipates the expert's objection ("that's not the official figure") and answers it before it's raised.
  - Historical analogues make an abstract number concrete.
  - The official figure gets its own box, visually separate from the model's.
- **Weakness:** it's a long modal with the chart pushed below the fold.
- **Take for TruMarket:**
  - Copy this pattern exactly for **every ⓘ** on score, coverage, NDVI and El Niño.
  - For El Niño specifically, show **ICEN (official, ENFEN)** next to Niño 1+2 from NOAA. BCP risk teams will know ICEN.
  - Put the chart first, then the explanation.

### 8.4 Alert centre (`/dashboard/alerts`)

- **Layout:**
  - Title "Alert centre — Peru" and "20 active alerts · 1 red".
  - Type and level filters at the top right.
  - Tabs: "Rixkia alerts 20" / "Official notices".
  - A search box, a place filter and a "20 of 20" counter.
  - A **6-tile summary grid**.
  - A list of alert cards.
- **Summary tiles:** Active 20 / Red 1 / Orange 2 / Yellow 17 / Seismic 1 / Floods 5. Each tile has a **coloured left border** and an icon, and the Red tile has a pink fill.
  - *Why it works:* severity is shown at a glance, and the colour is on the border, not the whole tile, so the page stays calm. Only the most severe tile gets a fill.
- **Alert cards:** icon, bold title ("M6.0 earthquake — 96 km W of San Juan de Marcona, Nasca - Ica"), RED and Seismic chips, two lines of guidance ("If you are in the area: stay clear of damaged structures…"), place · age, then **View in full** and **View on the map** buttons. The red card has a pink background and a red left border.
  - *Why it works:* every alert tells you **what to do**, not just what happened, with two clear next steps.
- **Tabs separating "our alerts" from "official notices":** keeps model output and authority output apart. This is very good for trust.
- **Weaknesses:**
  - Filters appear in two places (the header dropdowns and the search row).
  - The tiles mix severity counts with hazard types in one grid.
- **Take for TruMarket:**
  - **Inbox header tiles:** Files 61 / Decisions due 3 / High risk 1 / Watch 7 / Repaid 12. Use left borders, and fill only the High-risk tile.
  - **Alert cards in "What happened"** always end with the **action for the analyst** ("Call field inspection before releasing T3") plus "Open panel" and "View on map".
  - **Tabs in "What happened":** "System alerts" / "Public news & official notices", matching our All / Public / System filter.

### 8.5 Reports (`/dashboard/informes`)

- **Layout:** an eyebrow label "REPORTS · RIXKIA PERU", a big title, the intro "Citable documents, with open data and sources", then a list of report cards: icon, title, two-line summary, "Read the report →", and a "Public link" under each.
- **Why it works:**
  - Reports are framed as **citable** documents with sources, which is the language of an institution, not a startup.
  - Each card has a single action.
- **Weakness:** no dates or authors on the cards.
- **Take for TruMarket:**
  - The **Credit memo** should be a first-class, citable document: a stable link, date, model version, sources and analyst name.
  - Add a "Reports" area with a portfolio pre-harvest monthly report and campaign close reports.

### 8.6 Risk by location (`/dashboard/territorio`)

- **Layout:** the title "Risk by location — what is inside", the subtitle "Draw a district, a basin or a stretch of coast", then a **5-option picker**:
  - Find a place
  - By district or region
  - A property or a block
  - Draw on the map
  - I have the coordinates

  Each option is a card with an icon and a one-line hint. Below that: a radius input with preset chips (5 / 10 / 15 / 20 km), the search field, "Or use my location", then the map with an empty-state card ("Choose a place above and it will appear here") and a "Where to go next" section.
- **Why it works:**
  - It **offers every way people describe a location**, in plain words.
  - Preset chips plus a free input.
  - A helpful empty state and next-step links.
- **Weakness:** the 503 errors seen during the review show the page is fragile.
- **Take for TruMarket:** the **wizard Location step**. Offer "Draw parcel / Paste coordinates / Upload KML / Search place" as icon cards, show the declared vs measured area live, and include the empty state.

### 8.7 Transport route (`/dashboard/ruta`)

- **What it is:** draw an access route, then see kilometre by kilometre where it gets cut. "Finish the route" and "Clear" buttons sit above a full satellite map.
- **Why it's interesting:** it models the **dependency** (the road to the asset), not just the asset itself.
- **Take for TruMarket:**
  - Later, for the "Harvest repayment" panel, show the route from parcel to packhouse with hazard exposure (debris flows on the Panamericana Sur during a coastal El Niño).
  - This is a strong differentiator for the El Niño risk story.
  - **Effort:** L, so for v2.

### 8.8 Portfolio (`/dashboard/cartera`)

- **Layout:** the title "Portfolio — many addresses at once, ranked by exposure", then a "Paste your addresses" card. It accepts one point per line (reference, lat, lon, optional sum insured), with a search to add points, a large textarea, a radius dropdown (3 km), "See an example", and a primary "Score 0 points" button that stays disabled until there is input.
- **Microcopy:**
  - "Three kilometres is the scale at which a debris flow or a river flood reaches one specific property…" explains **why the default value is what it is**.
  - "None of this is stored. The points are scored and returned…" states the **privacy position** up front.
- **Why it works:**
  - The button label carries the count ("Score 0 points"), which makes it feel like a live tool.
  - The example is one click away.
  - Each default is justified in a sentence.
- **Take for TruMarket:**
  - In the **wizard**, justify each threshold in a line ("Harvest estimate must be ≥ 85% of declared — below that, revenue coverage falls under 1.5×").
  - Add a data-handling note on the upload step ("The PDF is stored in BCP's file; fields are extracted, nothing is shared").
  - Let a button label carry its count ("Verify 10 checks").
  - Later, an **Inbox "Bulk score"** feature: paste a list of parcels or coordinates to rank a pre-harvest pipeline by exposure.

### 8.9 How it works (`/dashboard/metodo`)

- **Layout:** eyebrow, a big title "What Rixkia is, how it works and how far it goes", an intro that says plainly what it is **and isn't** ("It is not an authority and does not replace one"), an in-page link row (What it is · How each hazard is computed · How it is checked · Why it is robust · Where the data comes from · Independence and limits), a "Download the fact sheet (PDF)" button, then two-column feature points ("Real time and multi-hazard", "With published methods… nothing is a black box").
- **Why it works:**
  - **Stating its limits builds trust.**
  - Anchor links make a long page scannable.
  - The downloadable fact sheet is something a buyer can forward.
- **Take for TruMarket:** a **Method & sources** page structured the same way, which doubles as BCP's model-validation pack:
  - What the score is and isn't (it "supports, does not replace, the credit committee").
  - How each area is scored (Production 50 / Operator 35 / Structure 15 / Buyer 0).
  - Thresholds and their rationale.
  - Data sources and how recent each is.
  - Backtest (the replay is ideal evidence).
  - Limits.
  - A PDF fact sheet.

### 8.10 Visual system: assessment

| Aspect | Rixkia | Verdict for TruMarket |
|---|---|---|
| Colour | A navy and teal shell with a four-step severity scale (red, orange, yellow, green). Colour appears on borders, chips, dots and qualifier text; fills are used only for the worst level | **Copy the restraint:** colour marks severity only, and only the worst state gets a fill. Use **three** levels (Normal / Watch / High risk) plus grey for unknown. Four levels is too many for a credit decision |
| Type | Space Grotesk for titles and numbers, Inter for body; generous title sizes | Keep our serif `font-display` for the client name and the big score, which feels banky. Use **tabular numbers** for every figure |
| Density | High on the Live map (six bands above the map), comfortable on the content pages | Our loan file should be like their content pages: one hero (the decision), then a compact number row, then detail in tabs |
| Microcopy | Plain, honest and explanatory: limits stated, defaults justified, official sources quoted | **The biggest lesson.** Every number gets a one-line "why", and every default a reason |
| Trust signals | Official vs model figures side by side, sources on every panel, version number, a "not an authority" disclaimer, citable reports | Adopt all of them; they fit BCP's audit and model-risk requirements |
| Motion | Minimal; panels slide in | Fine. Our motion spec (§4) adds count-ups and chart extension for the replay |
| Weak spots | "REAL TIME"/"LIVE" labels, crowded clusters of map markers, truncated ticker text, a header bubble that breaks the layout, 503 errors on several pages, filters duplicated in places | Avoid all of these (see §6) |

### 8.12 Hazard modules (Seismic, Floods, Wildfires, Debris flows, Coast, Volcanoes)

These six pages share **one template**:

- **Title and subtitle:** a title ("Seismic module — Peru") with a subtitle that defines the data ("The earthquakes of the official catalogue and how often one of each size is expected in each zone").
- **Window chips:** a time-window segmented control at the top right (24h / **3d** / 7d / 30d for Seismic; 6h / 12h / **24h** / 2d / 5d for Wildfires), plus a refresh button.
- **Report banner:** a link banner to the related report ("Is it shaking more than before? — what ten years of the seismic catalogue say").
- **KPI row:** four tiles (Seismic: Total quakes 16 · Max magnitude 6.0 · Avg magnitude 4.48 · Avg depth 89 km; Wildfires: Active hotspots 430 · High confidence 29 · Total FRP 5,434 MW · Avg brightness 339 K). Each has a tinted icon square and a **coloured left border**.
- **Tabs:** "What is happening now · Scenario · Simulation · Events / Hotspots (count)".
- **Wildfires "now" tab:** an **"Official SENAMHI notices"** block, with "Service checked 1 min ago" and the line "This system does not produce it: it is shown next to what it computes, not mixed with it". Each notice card has a severity chip ("extreme intensity"), the index name, "in force · of Wed, Nov 18", a headline, and a "What the notice says" disclosure.
- **Scenario tab:** "What if…?" with a badge **"ILLUSTRATIVE SCENARIO · NOT A WARNING"** and "Copy link to this scenario".

**Why it works:**
- One template means users learn it once.
- The window chips match how each hazard behaves: hours for fire, days for quakes.
- Tabs separate **observed now**, **what-if** and **model**.
- Official notices are clearly fenced off from model output.
- Scenarios are labelled so nobody mistakes them for warnings.
- Every scenario has a shareable link.

**Weaknesses:**
- Some KPIs are technical noise for most users (avg brightness 339 K, total FRP).
- The title wraps over three lines next to the controls.

**Take for TruMarket:**
- **Monitoring panels share one template:** a severity chip, a one-line conclusion with an action, window chips (4w / 12w / Campaign / 5y), the chart, the source with "checked N ago", and triggers. This is the fix for "five similar cards".
- **A "What if" tab** in Credit analysis, replacing the stress grid: "Price −20% · Yield −15% · Coastal El Niño moderate". Badge it "Illustrative scenario · not a forecast" and give each scenario a copyable link for the credit committee.
- **Official vs computed fencing:** show SENAMHI, ENFEN and SUNAT outputs in their own boxed block labelled "Official source, not computed by TruMarket".
- **Choose KPIs a credit analyst would act on.** Avoid raw sensor metrics such as mean NDVI reflectance bands.

### 8.13 Simulations (`/dashboard/simulaciones`)

- **Layout:** a long editorial page, "The simulations, one by one". Its rule: "no figure without its method and no simulation without its validation". Each hazard gets a card with:
  - **How:** the model, with citations (Zhao et al. 2006, Strasser et al. 2010…).
  - **With which data:** the input datasets.
  - **Measured accuracy:** for example "97% of points within one intensity degree against 69 official shaking maps…".
  - An "Over time" chip.
- **Why it works:** it is effectively a model card for each model. This is exactly what a bank's model-risk team asks for.
- **Take for TruMarket:** a **Model card** for each scoring area (Production, Operator, Structure, Buyer) and for the forecasts (NDVI outlook, price band), each with How / Data / Measured accuracy (from the historical replays). Place it in "Method & sources" and link it from each ⓘ.

### 8.14 A point (`/dashboard/punto`)

- **Layout:**
  - The title "Any given point" and "The modules work on a catalogue of 470 sites. This answers for yours, whether it is on the list or not."
  - One coordinate input with format help ("Accepts decimal degrees, degrees and minutes, and UTM. If they come in PSAD56, convert them first").
  - "Or try:" example chips (Chosica, Las Bambas, Pucusana).
  - A "Where to go next" card grid.
- **Why it works:**
  - A single input with flexible formats.
  - Example chips make the empty state usable straight away.
  - The help covers Peru-specific coordinate datums (PSAD56), which shows domain care.
  - "Where to go next" avoids dead ends.
- **Take for TruMarket:**
  - In the wizard Location step, accept decimal degrees, DMS and UTM, and warn about PSAD56 vs WGS84. Peruvian cadastral data (SUNARP, COFOPRI) often uses UTM.
  - Add "Try:" chips with sample parcels to the empty Inbox.
  - End every page with a "Where to go next" row.

### 8.15 Forecast (`/dashboard/pronostico`)

- **Layout:**
  - "Forecast for a site": "What is going to happen here, over three horizons, with the method and the skill of each. **Not a scenario.**"
  - A coordinate input, a Forecast button, and "Or try" chips.
  - "Computing the forecast for the nine regions…" as an honest loading message.
  - A map, "Where something is announced right now", where zones with a forecast above green are clickable. The map has a View switch (Map / Satellite / 3D relief) and the Sea and El Niño layer.
- **Why it works:**
  - **Three horizons** (days / months / years), each with **its method and its skill** stated.
  - It explicitly separates a forecast from a scenario.
- **Take for TruMarket:** the forward view (§5) should show **horizons**:
  - **Next 2 weeks:** Open-Meteo, high skill.
  - **To harvest:** seasonal outlook and NDVI analogues, medium skill.
  - **Next campaign:** El Niño outlook, low skill.

  Label each with its skill, for example "Hit rate 78% on 2019–2025 replays". Never call a forecast a scenario, or the other way round.

### 8.16 Forecast by zone (`/dashboard/predictions`)

- **Layout:**
  - "What each monitored zone has announced right now, with the detail of what it is based on."
  - A card, **"How well this system gets it right"**: each prediction at yellow or above is checked 48 h later against satellites and seismographs. For example:
    - Wildfires Yellow: **64%** (1,423 of 2,222).
    - Floods Red: **0%** (0 of 6).
    - Floods Orange: 13%.
    - Floods Yellow: 3%.
  - A caveat for earthquakes.
  - An amber callout: "These are probabilities, not announcements that something will happen… Nobody can predict the exact place, time and magnitude of an earthquake".
- **Why it works:**
  - It **publishes its own hit rate, including bad numbers** (0% on red floods), next to the predictions.
  - It shows the numerator and denominator, not just a percentage.
  - This is the strongest trust feature in the product.
- **Weakness:** showing 0% and 3% without context may undermine confidence among non-experts.
- **Take for TruMarket:** a **"How well the score has predicted"** card on the Inbox or portfolio view. For example: "Files scored Watch at fruit set: 22% ended with a repayment shortfall (4 of 18); Normal: 3% (2 of 61)". Show counts, update after each campaign, and add a one-line caveat ("probabilities, not certainties").

### 8.17 History (`/dashboard/history`)

- **Layout:**
  - "Disaster history — Peru: earthquakes, hotspots, floods and alerts in one record", with an **Export CSV** button.
  - "What has happened around a point": coordinates, a radius (25 km) and "See the history", with "My location".
  - **Filters:** From/To dates, Department, Severity, Minimum magnitude slider.
  - **Preset chips:** 7 days / 30 days / 90 days / **1 year** / 5 years, plus Clear filters.
  - **Type toggle chips:** Earthquakes, Hotspots, Floods, Fires attended, Issued alerts, Road closures, Ravines on alert (forecast).
  - An "Events per month" chart.
- **Why it works:**
  - **One record across all event types**, with toggle chips coloured by type.
  - Presets plus exact dates.
  - A radius search around a point.
  - CSV export for analysts.
- **Take for TruMarket:**
  - The **"What happened" tab**: type toggle chips (Satellite · Weather · El Niño · Market · News · Decisions · Alerts), presets (This campaign / Last 3 campaigns / 5 years), an "Events per month" bar chart above the vertical timeline, and **Export CSV**.
  - A **parcel history** feature: events within 25 km of the parcel over 5 years (floods, debris flows, fires, frost). This is strong underwriting evidence for the application step.

### 8.18 Exercise mode (`/dashboard/ejercicio`)

- **Layout:**
  - "Exercise mode — Peru: to rehearse how your team would respond to a real disaster, seeing the information in the order it arrived", with **Download the log**.
  - A full-width info banner: **"This is an exercise. These are records of something that ALREADY happened, replayed. It is not the state of the country right now."**
  - Three numbered steps: 1 Choose an episode · 2 Play it (events appear hour by hour, in Lima time, as they came in) · 3 Decide at each pause (at key moments it stops; the team decides and sees what came next).
  - Episode cards, each with a date range and coloured hazard dots ("M7.2 Coracora earthquake 19–22 Aug 2026", "The worst wildfire day", "Five hazards at once"…).
  - A description of the selected episode.
  - Playback: restart, previous, **Play**, next, the clock "Wed 19 Aug, 00:46 · Lima time · Hour 1 of 95", and **speed 1× / 2× / 4× / 8×**.
- **Why it's the most relevant page for TruMarket:** it is the same idea as our **campaign replay** ("what the bank would have known on each date"), done well:
  - A persistent banner states clearly that this is past data.
  - **Automatic pauses at decision points**, where the user decides and then sees what came next.
  - Episodes are presented as cards.
  - Speed control and an hour counter.
  - A downloadable log of the decisions taken.
- **Take for TruMarket** (high priority, M):
  - **Replay banner:** "Viewing this file as of 23 Feb 2026, with the data available on that date. This is not the current state of the loan." Wording matters: never "demo" or "simulation".
  - **Pause at each tranche decision:** the replay stops at T2 and T3, the analyst chooses Hold / Inspect / Approve, then playback continues and shows the outcome. This makes for strong training and a strong sales demo for BCP.
  - **Episode cards** for notable past campaigns: "2017 coastal El Niño — Ica", "2023 heat at flowering", "Normal campaign 2024-25".
  - **Speed 1× / 2× / 4×** and "Week 24 of 26" next to the play button.
  - **Download the decision log** as CSV or PDF, for audit.

### 8.19 Performance (`/dashboard/desempeno`)

- **Layout:**
  - "Prediction performance: how many of the issued alerts were later confirmed".
  - Skeleton loading (grey bars) while data arrives.
  - Tabs: On the map · Trend and calibration · The engine, measured · Case by case.
  - "Where to go next" cards (Forecast by zone, What already happened, Forecast over three horizons).
- **Why it works:**
  - A whole section dedicated to **calibration and back-testing**, with drill-down to individual cases.
  - The skeleton loader matches the layout, so there is no spinner.
- **Take for TruMarket:** a **Model performance** page, also part of the BCP validation pack:
  - **Calibration:** predicted vs observed default or shortfall rate by tier.
  - **Trend:** performance by campaign.
  - **Case by case:** link each closed file's score at each tranche to its final outcome.
  - Use skeleton loaders (§4).

### 8.20 The API (`/desarrolladores`)

- **Layout:** a documentation page:
  - "The data, through a documented API".
  - Base URL, version 0.1.0, **188 read routes**, "Download OpenAPI", data sources.
  - "How to use it", as a two-column table: KEY (Bearer token from login, refresh token, SSE and WebSocket tickets), LIMIT (120 req/min per IP, 429 with Retry-After), CACHE (X-Cache, Cache-Control), ERRORS (422, 404, 503 when an upstream source is down).
- **Why it matters:** the product is designed as data infrastructure, not just a UI, with clear limits, caching and error semantics.
- **Take for TruMarket:**
  - BCP will eventually want the scores and alerts in its own systems (core banking, risk data warehouse).
  - Plan a **read API** for files, scores, alerts and decisions, plus a webhook on severity change, documented the same way.
  - Mention it in the BCP pitch as the integration path.

### 8.21 Rixkia AI (`/dashboard/chat`)

- **Layout:**
  - "An assistant with access to the system's active alerts".
  - The intro message states what it can do, and gives emergency numbers (INDECI 0800-11-111, Fire Service 116).
  - **Suggested-question chips** ("Which alerts are active right now?", "How does El Niño affect the northern coast of Peru?").
  - An input box.
  - Footer: "Answers are indicative and may contain errors. They do not replace the official notices of INDECI, SENAMHI or the IGP."
  - A "New conversation" button.
- **Why it works:**
  - Its scope is stated up front.
  - Suggested chips solve the blank-box problem.
  - A clear disclaimer, with authority deferred to official sources.
- **Weakness:** it's a separate page, disconnected from the context the user is looking at.
- **Take for TruMarket (v2):**
  - An "Ask about this file" panel **inside the loan file**, with chips such as "Why did the score drop?", "What would make T3 safe to release?" and "Summarise the risks for the committee".
  - It answers only from the file's data, with citations to panels.
  - Disclaimer: "Supports the analyst; does not replace the credit committee."
  - Don't make it a standalone chat page.

### 8.22 My account (`/dashboard/cuenta`)

- **Layout:** "My account", with the name and email; Sign out next to the title; a "My details" card (account opened date, verified email, "The email cannot be changed: it is the account's identity", Full name, Organisation optional, Mobile optional, Save details); and a Password card.
- **Why it works:** it explains the rules in context (why the email can't change) and keeps optional fields to a minimum.
- **Take for TruMarket:**
  - Add a role (Analyst / Credit committee / Read-only) and a signature name used in the decision log and credit memo.
  - With BCP, plan SSO rather than passwords.

### 8.23 Summary: what to adopt, in priority order

1. **Context strip with official vs model values** (8.3 #3 and 8.3.a): the El Niño ICEN pattern. Effort S.
2. **Severity-filtered default view with a clear "Show all"** (8.3 #8): for the Monitoring tab and the Inbox. Effort S.
3. **Past-today-forecast slider with presets and "Back to today"** (8.3 #5). Effort M.
4. **Neutral main number, coloured qualifier** (8.3 #4): for the KPI row. Effort S.
5. **Alert cards that end with an action and two buttons, plus an expiry or re-check date** (8.4, 8.3 #9). Effort S.
6. **Single legend for the whole encoding** (8.3 #11). Effort S.
7. **"What is this?" on every page plus a Method & sources page with a PDF** (8.2, 8.9). Effort M.
8. **Summary tiles with severity left-borders, filling only the worst** (8.4): for the Inbox header. Effort S.
9. **Wizard Location step as an icon-card picker, with justified defaults and a data-handling note** (8.6, 8.8). Effort M.
10. **Citable credit memo and reports with stable links** (8.5). Effort M.
11. **Replay with decision pauses, episode cards, speed control, "past data" banner and decision-log export** (8.18). Effort M. *Highest value for the BCP demo.*
12. **One template for all Monitoring panels, with window chips and tabs for now / what-if / model** (8.12). Effort M.
13. **Published hit rate ("How well the score has predicted") and a Model performance page with calibration** (8.16, 8.19). Effort M.
14. **Model cards (How / Data / Measured accuracy) for each scoring area** (8.13). Effort S.
15. **Forecast horizons, each labelled with its skill** (8.15). Effort M.
16. **"What happened" as a filterable record with type chips, presets, a monthly chart and CSV export, plus 5-year parcel history** (8.17). Effort M.
17. **Sidebar grouped into Files / Outlook / Record, under 8 items with nothing hidden below the fold** (8.2 sidebar map). Effort S.
18. *(v2)* **Route exposure from parcel to packhouse** (8.7), **bulk scoring for the pipeline** (8.8), **a read API and webhooks for BCP** (8.20), **"Ask about this file" assistant** (8.21). Effort L.
