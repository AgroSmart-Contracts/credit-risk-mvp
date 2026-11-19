# Design research brief: pre-harvest lending module

You are helping redesign a web app. Browse real forecast and monitoring web applications, study how they present data, motion and interaction, and come back with concrete recommendations for our app. Everything you need to know about our app is in this file.

## 1. What the app is

A credit tool for a Peruvian bank (BCP) that lends to avocado growers before harvest. The user is a bank credit analyst, not a farmer.

The cycle:

1. The analyst uploads the grower's application PDF.
2. The app reads its fields.
3. It locates the parcel on satellite imagery.
4. It verifies the application with satellite, weather and registry data.
5. It scores the loan.
6. It opens a loan file.
7. It monitors the orchard week by week until harvest. Disbursements are released in tranches, and repayment comes from the buyer's purchase order.

The app looks forward and backward in time. It forecasts the risk to the loan from crop health, weather and El Niño, and export prices. It can also replay a past campaign week by week, showing what the bank would have known on each date.

The tone must feel like a real banking product. Never use the words "demo", "mock" or "simulation" in the UI.

## 2. Tech constraints

Recommendations must be buildable with this stack:

| Area | What we use |
|---|---|
| Framework | React 19, Vite, TypeScript |
| Styling | Tailwind CSS v4 with custom tokens: `tm-black`, `tm-surface`, `tm-neutral`, `tm-border`, `tm-primary` (green), `tm-accent` (amber), `tm-danger` (red), `font-display` (serif) |
| Charts | Recharts (line, area, reference lines and areas) |
| Maps | Leaflet with Esri World Imagery tiles; parcel outlines as polygons |
| Animation | framer-motion (installed, barely used) |
| Icons | lucide-react |

Other requirements:

- The UI is bilingual (English and Spanish) and has a printable "credit memo" mode.
- Pages must work at phone width.
- Suggest a new library only when the gain is large. Name it, and say why Recharts, Leaflet or framer-motion can't do the job.

## 3. Current screens and what they show

### Shared look

- **Desktop layout:** a left sidebar with the logo and four nav icons, a top bar with the page title, and a medium-width content column.
- **Mobile layout:** the sidebar becomes horizontal tabs.
- **Visual style:**
  - White cards with thin borders, rounded corners and a soft shadow.
  - Serif display font for titles and big numbers.
  - Small uppercase grey labels above sections.
- **Status colours:** green means fine, amber means watch, red means high risk.
- **File status pills** (each with a coloured dot): Normal, Watch, Follow-up, Hold, Stopped, Repaid, Application.
- **Motion:** almost none today. There is one spinner on Refresh, and the replay steps every 600 ms with no transition.

### Inbox: the list of loan files

- **Header:**
  - Title.
  - File count and how many files need attention.
  - Language switch.
  - "New application" button.
- **Table rows:**
  - Client, location and hectares.
  - Campaign and "as of" date.
  - Amount in USD.
  - Status pill.
  - Next recommended action, in one line.
- **On mobile:** rows stack as blocks.

### New application wizard (five steps, shown as pills)

1. **Document:** a drag-and-drop area for the PDF.
2. **Review:** a table with three columns: field, value, and the exact source line from the PDF. Missing required fields are shown in red.
3. **Location:** the parcel outline on a satellite map, with two checks:
   - Declared vs measured area.
   - Declared place vs the place name found from the map.
4. **Verification:** about 10 pass / fail / pending rows:
   - Satellite (all based on NDVI, a 0 to 1 greenness index):
     - Crop standing before the loan.
     - Crop type consistent with avocado.
     - Orchard age vs satellite history.
     - Vigour vs the parcel's own norm.
   - Water:
     - Water licence.
   - Climate:
     - El Niño.
   - Registries:
     - Tax registry.
     - Land title.
     - Credit bureau.
     - Phytosanitary zone.
5. **Assessment:** the recommendation, score and tier, terms, and the full score breakdown.

### Loan file: top section (always visible)

- **Header card:**
  - **Parcel image:** an aerial image with the parcel outline and an NDVI badge.
  - **Pills:** status, campaign, and "Day X of 180".
  - **Title block:**
    - Client name.
    - Location with declared vs measured hectares.
    - "Data as of [date]" with the source names.
  - **Buttons:** Refresh, Credit memo, language.
- **Replay bar:**
  - Play / pause / restart.
  - Weekly range slider.
  - "Week N / total · date".
  - Jump to end.
  - News articles published that week appear below it.
- **Decision card:**
  - The decision needed now, for example "Release tranche 40% · USD 12,000", with its due date.
  - Condition chips, each with its evidence.
  - A recommendation sentence.
  - Hold / Inspect / Approve buttons, with a confirm form (analyst name and note).
  - On a closed file, an outcome card replaces it:
    - Amount disbursed.
    - Purchase order (tonnes × price).
    - Volume vs expected.
    - Price vs reference.
    - Main risk.
- **Four headline numbers:**
  - **Score:** score out of 100 with tier, change since approval, a red-to-green bar with a marker, and the line that moved it most.
  - **Exposure:** amount outstanding, % disbursed bar, amount due at maturity, coverage ratio.
  - **Repayment:** maturity date and purchase-order status.
  - **Signals:** up to two areas in amber or red, with trigger text.
- **Campaign timeline:**
  - Five steps: Approval, Fruit set, Pre-harvest, Harvest and purchase order, Maturity.
  - Each step shows planned / released / held N days.
  - A progress line and a "today" marker.

### Loan file: tabs

- **Summary:**
  - Facility table: type, amount, rate, loan-to-value, repayment source.
  - Leaflet field map coloured by crop status.
  - Key risks and mitigants.
  - Four metrics: bureau rating, regulatory provision, expected loss, break-even price.
- **Credit analysis:**
  - Score gauge.
  - Four scored areas with their point lines:
    - Production (50%).
    - Operator (35%).
    - Structure (15%).
    - Buyer (0%).
  - A price × yield stress grid. It may be removed.
- **Monitoring:** five stacked cards. Each has a severity chip, a one-line conclusion with an action chip, the chart, its source and its triggers.
  1. **Satellite:** true-colour and NDVI images side by side; four stats; a colour scale; a strip of scene dates.
  2. **Crop:** NDVI line vs the 5-year median, with amber and red threshold lines and milestone markers.
  3. **Weather:**
     - Max and min temperature, with the flowering-sensitive period shaded.
     - Rainfall anomaly.
     - El Niño index (Niño 1+2, Niño 3.4).
     - Water coverage.
  4. **Market:** export price vs the seasonal median and its normal range, with P25 / P10 lines.
  5. **Harvest repayment:** a three-step checklist (purchase order, credit insurance, advance) and a coverage bar against 1.0×.
- **What happened:**
  - A vertical timeline mixing public news (headline, source, summary, "For this file"), system alerts and milestones.
  - Grouped into before / during / after the campaign.
  - Filter: All / Public / System.
- **Disbursements & audit:**
  - Three tranche cards with their conditions.
  - Analyst decision log.
  - Alert log table.
- **Application file:**
  - Editable application figures.
  - Third-party checks, each with its date.
  - Data sources, with how recent each one is.

### Data behind it

| Data | Source | Notes |
|---|---|---|
| Satellite | Sentinel-2 | NDVI series and 10 m images |
| Weather | Open-Meteo ERA5 | Daily |
| El Niño | NOAA CPC | Monthly |
| Export prices | Veritrade, UN Comtrade | Monthly FOB in USD/kg |
| News | Real articles | Linked in the "What happened" tab |
| Registries, purchase order, insurance | Bank records | Stored per client |

## 4. Known weaknesses

- **Monitoring tab:** a long scroll of five similar cards, with no overview or in-page navigation.
- **Replay:** jumps between weeks with no transitions, and charts redraw abruptly.
- **Forward view:** little sense of "forecast". Charts stop at today, with no projected band, confidence range or outlook to harvest.
- **Hierarchy:** the decision card, the four headline numbers and the timeline all have the same visual weight.
- **Charts:** they look default. Tooltips are plain and the threshold lines are thin dashed lines.
- **Maps:** the satellite map and the images are static, with no time-lapse of the parcel.
- **Duplication:** some figures (loan-to-value, rate, amount) appear on both the Summary and Credit analysis tabs.
- **Colours:** a few colours are hard-coded instead of using the tokens.

## 5. What to research

Visit several real forecast and monitoring web apps, for example:

- **Weather and climate:** Windy, Ventusky, Meteoblue, Apple Weather on the web, NOAA Climate.gov ENSO pages, Copernicus Climate Pulse.
- **Agriculture and satellite:** EOS Crop Monitoring, OneSoil, Sentinel Hub EO Browser, Planet Explorer, Google Earth Engine timelapse.
- **Finance and risk dashboards:** Bloomberg-style terminals, Stripe Dashboard, Linear, Mercury, Ramp, Robinhood charts.
- **Time-based storytelling:** NYT and Reuters graphics, Our World in Data, Flourish story examples.

Add any others you find better. For each one, note what it does well that we could use in these areas:

1. **Forecast presentation:** how projections, confidence bands, "today" markers and outlooks are drawn.
2. **Time scrubbing and playback:** sliders, play controls, how charts and maps animate between dates, and how events appear on a timeline.
3. **Map and imagery:** time-lapse, before / after swipe, layer toggles, legends, parcel highlighting.
4. **Alerts and severity:** how risk levels are shown without visual noise.
5. **Information hierarchy:** how one key decision or number leads the page while detail stays one click away.
6. **Micro-interactions and motion:** number count-ups, chart line drawing, hover tooltips, skeleton loading, card transitions, page transitions.
7. **Overall polish:** typography, spacing, colour use, dark mode.

## 6. What to send back

A single report with:

1. **Top 10 recommendations, ranked by impact.** For each one:
   - The idea in one sentence.
   - Which of our screens or components it applies to (names from section 3).
   - The reference app and the URL where you saw it.
   - How to build it with our stack (section 2): which library features or techniques.
   - Effort: small, medium or large.
2. **A motion spec:** for each motion, give durations, easing and the trigger, using framer-motion terms. Cover:
   - Replay week changes.
   - Card entry.
   - Number changes.
   - Chart updates.
   - Tab switches.
   - Severity changes.
3. **A forecast view proposal:** how the crop, weather and price charts and the harvest repayment card should show the expected path to harvest next to the observed data.
4. **A layout proposal for the loan file:** where things should move, with a rough ASCII wireframe for desktop and mobile.
5. **Things to avoid:** patterns you saw that would look gimmicky or hurt trust in a banking tool.

Keep recommendations specific. "Make it more modern" is not useful. "Animate the NDVI line drawing from the previous week to the new point over 400 ms ease-out when the replay advances" is.
