---
title: "How the Credit Risk Scoring Tool Works"
date: 2026-07-09
type: workflow-explainer
status: interim tool — scoring weights are a starting placeholder, not AC's final formula yet
tags:
  - trumarket
  - credit-risk
  - how-it-works
moc:
  - '[[Credit-Risk/_index]]'
related:
  - '[[Credit-Risk/02-Scoring-Engine/credit-risk-scoring-tool.html]]'
  - '[[Credit-Risk/00-Brain/mechanism-decisions.md]]'
---

# How the Credit Risk Scoring Tool Works

> A plain-language walkthrough of what happens when you use the tool — no technical background needed.

## What it's for

This tool looks at a trade-finance deal — who's buying, who's selling, what's being shipped, and how the deal is structured — and turns that into a single risk score, along with a sense of how confident that score actually is. The goal is to make lending/financing decisions consistent and explainable, instead of relying purely on gut feel.

## The walkthrough

**1. You upload the deal's documents.** Contracts, purchase orders, sales agreements — whatever you have. These stay attached to the deal so anyone looking at it later can see exactly what it was built from.

**2. The AI reads the documents and fills in what it can.** Click "Extract with AI" on any uploaded file, and it reads the document and proposes values for whatever it can find directly stated — product details, pricing, payment terms, shipping route, and so on. Nothing gets applied automatically: you get a checklist of proposed values, each with a one-line explanation of where it came from, and you choose what to accept before anything is saved.

**3. Counterparty details get filled in from online research.** For the buyer and the supplier, you can enter their name and click "Research online." The tool looks them up — business registries, tax authorities, credit bureaus, that kind of thing — and proposes things like years in business, license status, and credit rating, the same reviewable-checklist way as step 2.

**4. If a counterparty can't be found online, you're asked to fill it in yourself.** The research step doesn't guess. If it can't find something, it leaves that field blank rather than making something up, and you'll see it's empty and needs a manual answer.

**5. Product and shipping-route details get checked against AC's reference tables.** Things like how perishable a product is, typical shipping times for a given route, and how risky a specific product-and-destination combination tends to be — these get cross-checked against AC's own reference data on commodities and trade corridors, not just guessed at.

**6. Everything stays editable, no matter where it came from.** Whether a value came from a document, online research, the reference tables, or you typed it in yourself, you can always go back and change it. Nothing is locked in until you decide it's right.

**7. Once everything's in, you get a final score — and a confidence rating.** The score reflects the overall risk read on the deal. Separately, a confidence rating tells you how much of that score is actually backed by real information versus how much is still missing — so a high score built on very little data doesn't get mistaken for a fully-vetted deal.

## A few rules worth knowing

**No online presence at all counts against a counterparty.** If a buyer or supplier genuinely can't be found anywhere online through a credible source, that itself is treated as a real risk signal, not a neutral "we just don't know" — a business with zero digital footprint is a different (and generally riskier) situation than one that's simply new to TM.

**No prior history with TM has a real, but limited, effect.** If a buyer or supplier has never done business with TM before, that counts against their score. It doesn't drag down everything related to it, though — things like their completion rate or on-time delivery genuinely can't be measured with zero past transactions, so those specific numbers are left out of the picture entirely rather than treated as a bad mark.

**Import/export licenses are assumed valid unless you're told otherwise.** New deals start with both parties' licenses marked valid by default, since that's true the overwhelming majority of the time. If research or a document ever turns up a real problem, that gets corrected and flagged — the assumption is a starting point, not a way of hiding a real issue.

**The confidence rating is separate from the risk score.** A deal can score well but still have a low confidence rating if a lot of its fields are still empty — that's a signal to keep digging, not a reason to distrust the score itself.

## What's not finished yet

- **The scoring weights are still a working starting point**, not TruMarket's final, official methodology — that's still being finalized with AC. Treat scores as directionally useful today, not as the final word.
- **There's no automatic "hard stop" yet** for a small number of truly disqualifying facts (like a shipment with no cargo insurance at all) — those should eventually block a deal outright rather than just lowering its score, but that rule isn't wired in yet.
- **Everything currently lives in the browser you're using** — it isn't synced to a shared server, so it's best used from one place for now.

## Where to go for more

The tool itself is `credit-risk-scoring-tool.html`, right next to this file. Every scoring rule that's been decided so far — including the ones summarized above — is logged in full detail in `Credit-Risk/00-Brain/mechanism-decisions.md`, if you ever want the complete reasoning behind a specific rule.

---

*Written 2026-07-09. A more technical, code-level version of this document (for a developer picking up the tool itself) is kept in `Outdated/tool-developer-handoff-2026-07-09.md`.*
