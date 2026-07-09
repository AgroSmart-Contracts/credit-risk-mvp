---
title: "TruMarket — Risk Management (Site Page Draft v4)"
date: 2026-05-07
type: site-copy
status: ready-for-external-legal-review
draft-version: v4
supersedes: v3
review-required: external legal counsel + final AC sign-off
voice-reference: Circle (formal-institutional, plain English, structured disclosures)
target-audience: Banks, fund managers, sophisticated B2B counterparties (non-web3-native institutions)
target-length: ~2050 words
related:
  - "[[tm-how-it-works-DRAFT-v4-2026-05-07]]"
  - "[[trumarket-master-platform-tcs-DRAFT-v2]]"
  - "[[trumarket-capital-partner-addendum-DRAFT-v2]]"
  - "[[tm-site-pages-AUDIT-v1-2026-05-07]]"
tags:
  - trumarket
  - site-copy
  - risk-management
  - investor-facing
  - draft
v4-changes:
  - Added "Opt-out from further participation" paragraph to Liquidity Risk to mirror How It Works v4 operational lifecycle
  - Reaffirmed that the 60-day opt-out is prospective-only and does not create a redemption-right or daily-liquidity feature, preserving the not-a-fund legal posture
---

# Risk Management

Cross-border agricultural trade carries structural risks that no platform can eliminate. TruMarket's operating model is designed to make those risks identifiable, measurable, and — where possible — transferred to specialist counterparties that price them more efficiently than we can. This page describes how we approach the principal categories of risk in our business, what we mitigate against, and what we do not.

The disclosures below are summary in nature. Each transaction is governed by its own commercial agreements, and Capital Partners receive transaction-specific risk information in accordance with the Capital Partner Agreement. Nothing on this page is a substitute for the diligence each counterparty is expected to conduct on its own behalf.

## Risk taxonomy

We organise the risks of operating on the TruMarket platform into six categories. Each is described below.

| Category | What it covers |
|---|---|
| Counterparty / credit risk | Default by a buyer, seller, or other transactional counterparty |
| Operational risk | Document handling, milestone verification, settlement execution, platform code and infrastructure |
| Market risk | Commodity-price movement, foreign-exchange exposure, freight and input-cost shifts |
| Regulatory risk | Jurisdictional treatment, KYC/AML, sanctions, tax-authority interpretation |
| Liquidity risk | Capital deployment cycles, exit timing, secondary-market absence |
| Concentration risk | Single-counterparty, single-corridor, single-commodity exposure |

## Counterparty and credit risk

The principal risk in any trade transaction is that one or more counterparties does not perform: a seller fails to deliver goods of the contracted quality on the contracted timeline, or a buyer fails to settle on the contracted date.

**Buyer-side coverage.** Where credit insurance is available, transactions are placed primarily with **Coface**, an investment-grade specialist in cross-border commercial credit insurance and TruMarket's principal credit-insurance counterparty. Where Coface is unable to cover a specific counterparty, the transaction may be placed with a comparable specialist credit insurer, restructured into a smaller exposure, declined, or — where TruMarket determines the counterparty profile justifies direct exposure — taken on a fully-disclosed uninsured basis. The decision and rationale are recorded on the platform.

**Coverage limits.** Coface coverage is not unlimited and is not unconditional. Coverage is subject to:

- **Per-counterparty credit limits**, capping the maximum insured exposure to any single buyer regardless of transaction count
- **Country and sector limits**, with reduced or suspended coverage on counterparties domiciled in jurisdictions on Coface's restricted list, or operating in sectors temporarily downgraded by Coface (for example, a sector experiencing systemic distress)
- **Policy exclusions**, including disputes between the buyer and seller over goods quality, currency-control or sovereign-action events, and certain force-majeure scenarios
- **Claim conditions** — submission timelines, documentation requirements, and recovery obligations that the insured must satisfy for a claim to pay

Coverage does not eliminate buyer-side risk; it transfers a defined portion of it to a specialist insurer at a known cost. Capital Partners deploying capital in transactions that benefit from insurance coverage are exposed to residual buyer risk to the extent the coverage does not apply or does not perform.

**Seller-side controls.** Sellers must complete a structured know-your-business onboarding process before any prepayment is advanced. The process covers corporate identity, beneficial ownership, sanctions and integrity screening, and trade-specific qualifications (export licences, certifications, sector approvals where applicable). KYB status is monitored on a continuing basis; lapses suspend the Seller's ability to participate in new transactions until cured. Prepayment is released against verified shipping and commercial documentation, in milestones tied to verifiable trade events; this structure is designed to limit the exposure that exists at any single point in time.

**Capital Partner Vehicle non-segregation.** Capital Partner contributions held by AGRO SMART CONTRACTS pending deployment form part of the entity's general estate and are not legally segregated from AGRO SMART CONTRACTS' other liabilities, except where specifically agreed in the relevant Capital Partner Agreement. In the event of an AGRO SMART CONTRACTS insolvency event, undeployed Capital Partner contributions would rank pari passu with the entity's general unsecured liabilities.

**Inter-affiliate funding risk under Structure A.** Where a transaction is operated by TRU MARKET BLOCKCHAIN as commercial principal but Capital Partner contribution flows through AGRO SMART CONTRACTS (the two-structure deployment described in How It Works), the Capital Partner's economic exposure includes the performance of TRU MARKET BLOCKCHAIN to AGRO SMART CONTRACTS in respect of the inter-affiliate funding for that transaction. Recovery in case of default depends on the inter-affiliate contractual position and applicable insolvency law. This exposure is in addition to the underlying counterparty, cargo, and quality risks of the transaction itself.

**Recovery mechanics.** Where a counterparty defaults, recovery proceeds first through the relevant insurance claim (where applicable), then through the underlying commercial contracts. The TruMarket Operating Entity is the contracting principal in each transaction and pursues recovery in its own name. Recovery outcomes depend on the facts of the default, the applicable governing law, and the practical enforceability of the relevant contracts in the jurisdiction of the defaulting party. Recovery is rarely complete and is rarely fast.

## Operational risk

Operational risk in our business is the risk that the platform, its people, its third-party providers, or its infrastructure fails to do what it is designed to do.

**Documentation handling.** Each transaction generates a documentation trail — purchase orders, packing lists, bills of lading, customs records, inspection reports, lab analyses. The platform records the documentation chain as transactions progress. Errors in document handling — incorrect data, missing signatures, mistimed releases — can delay milestone disbursement, complicate verification, and impair recovery in a default scenario. Internal controls and third-party verification at each milestone are designed to reduce this risk; they do not eliminate it.

**Verification dependency.** The platform relies on third-party providers — inspection agencies, laboratories, freight forwarders, customs brokers — to verify the physical and commercial state of a transaction at each milestone. The integrity of the verification chain depends on the integrity of those providers. Where a provider performs inadequately, the platform's information about a transaction may be incomplete or incorrect. We retain providers selected on commercial reputation and track record; we do not warrant their performance.

**Settlement execution.** Settlement is executed on banking rails, regional payment infrastructure, and (where applicable) USD-referenced stablecoin rails. Each settlement rail carries its own operational risk profile — payment-system outages, correspondent-bank delays, sanctions-screening holds, blockchain network congestion or technical incidents, custody-provider operational failures. Settlement timing in cross-border trade is rarely instantaneous; failures or delays in settlement can cascade into commercial dispute or recovery scenarios.

**Platform code and infrastructure.** The platform is software. It carries the risks any institutional platform carries: software defects, infrastructure outages, third-party-service outages, data-integrity events, and cyber-security incidents. Where a portion of the settlement or document-tracking layer operates on blockchain infrastructure, additional operational risks apply: smart-contract code defects, oracle data-feed errors, network-level disruption, and the dependence of certain functions on the continued operation of specific public networks. The platform's code and infrastructure are subject to internal review and operational monitoring; this does not eliminate the risk.

**Business continuity.** TruMarket Group operations are concentrated in a limited number of jurisdictions and depend on a limited team. Personnel, premises, vendor, or jurisdictional disruption could materially impair the platform's ability to operate normally for a period.

## Market risk

TruMarket is the commercial principal in identified transactions, sitting between a seller and a buyer. The platform's commercial position is generally structured to limit direct exposure to commodity-price movement during the life of a transaction — the buy-side and sell-side prices are agreed in the same commercial cycle. However, residual market risk exists.

**Commodity-price movement.** Where a transaction is restructured, partially fulfilled, or terminated before completion, the platform may carry inventory or unhedged commercial exposure briefly while the position is unwound. Where the underlying counterparty defaults and the platform takes possession of goods, the platform is exposed to the market value of those goods at the time of disposal.

**Foreign-exchange risk.** Most transactions are denominated in USD or EUR. Where a transaction involves currencies other than the settlement currency, FX exposure exists between contracting and settlement; this is hedged or held depending on transaction-specific circumstances.

**Freight, fuel, and input-cost shifts.** Late shifts in freight cost, fuel cost, and certain input costs can affect the realised margin of a transaction relative to the modelled margin at structuring time. Material shifts are flagged in transaction-level reporting.

## Regulatory risk

The TruMarket Group operates commercial businesses subject to the corporate, commercial, tax, foreign-exchange, and anti-money-laundering laws of each jurisdiction in which it is incorporated or transacts. Regulatory risk in our business is multi-faceted.

**Jurisdictional treatment.** The platform is operated by AGRO SMART CONTRACTS, LDA. (Portugal) and TRU MARKET BLOCKCHAIN S.A.C. (Peru). Each entity is subject to the laws of its home jurisdiction. Cross-border transactions implicate the laws of additional jurisdictions, including those of the seller, the buyer, and any intermediating financial institution. Regulatory positions in those jurisdictions can change without notice.

**Regulatory authorisations.** Neither AGRO SMART CONTRACTS, TRU MARKET BLOCKCHAIN, nor any other Group entity is authorised by a financial-services regulator as a fund manager, alternative investment fund manager, broker-dealer, investment adviser, deposit-taker, or analogous regulated entity, and our business is structured to operate outside the scope of those regimes. The TruMarket Group's Capital Partner activity is structured as bilateral, identified-transaction commercial co-purchase, not as a collective investment scheme or alternative investment fund. The activity is intended to fall outside the scope of the EU Alternative Investment Fund Managers Directive and analogous regimes. A regulator in any jurisdiction could nonetheless take a view that some aspect of the platform's activity should be regulated; that view could materially affect the platform's ability to continue operating in that jurisdiction in its current form.

**Sanctions, KYC, and AML.** All counterparties — sellers, buyers, Capital Partners — are subject to know-your-business, sanctions, and anti-money-laundering screening before onboarding and on a continuing basis. A counterparty that becomes sanctioned, that fails ongoing screening, or that is otherwise subject to a regulatory restriction may be suspended or removed from the platform with immediate effect. Where a Capital Partner deployment is in flight at the time of such an event, the platform may unwind or reassign the affected position in accordance with the relevant Capital Partner Agreement and applicable law, with the resulting economic outcome flowing to the Capital Partner net of unwinding costs.

**Tax treatment.** Cash flows associated with the platform are subject to tax treatment in the relevant jurisdictions, including withholding tax on certain distributions to Capital Partners. Counterparties domiciled in jurisdictions on the Portuguese tax-haven blacklist (or analogous lists in other relevant jurisdictions) may be subject to elevated withholding rates. Counterparties are responsible for their own tax positions; the TruMarket Group does not provide tax advice.

## Liquidity risk

Capital Partners deploy capital on a **per-transaction basis** and against **identified transactions**. Capital is committed to an individual transaction at the time of deployment and is not freely transferable, redeemable on demand, or otherwise accessible until the underlying transaction completes and the relevant settlement and distribution waterfall has run.

**No daily liquidity.** The platform does not operate a redemption window, a daily NAV, a fund interest, or any other liquidity mechanism that would allow a Capital Partner to exit a position before the underlying transaction completes.

**Opt-out from further participation.** A Capital Partner may discontinue further participation by giving **60 days' written notice** to the TruMarket Group. The opt-out applies **prospectively only**: capital deployed in transactions in flight at the time of notice continues through to natural transaction completion, with distributions arising from those transactions returned to the Capital Partner on completion rather than re-deployed into new transactions. The opt-out does not create a redemption right against in-flight positions, a daily-liquidity feature, or any other early-exit mechanism applicable to capital that is already deployed.

**No secondary market.** No public or platform-operated secondary market exists for Capital Partner positions. Transfer of a Capital Partner Agreement requires the consent of AGRO SMART CONTRACTS and is governed by the relevant Capital Partner Agreement.

**Cycle length.** Underlying transactions typically run on a multi-week to multi-month cycle, depending on commodity, corridor, and commercial terms. Capital Partners should expect their capital to be locked for the duration of each individual transaction in which it participates.

## Concentration risk

Across an active book, exposure can become concentrated in a single counterparty, a single corridor, a single commodity, or a single insurance partner. Concentration risk is monitored at the platform level and managed by counterparty-level exposure limits, sector mix, and corridor diversification over time. Capital Partners participating in a series of transactions are advised to apply their own concentration controls; the platform does not impose them.

## What is not covered

The following are not in scope of TruMarket's risk-management framework and are the responsibility of each counterparty:

- Direct legal, tax, accounting, or investment advice in respect of a counterparty's participation
- Insurance against losses outside the contractual scope of trade-credit policies, including political risk where not specifically arranged
- Macroeconomic, geopolitical, or systemic shocks that affect the underlying market
- Each counterparty's own internal compliance, risk-management, and reporting obligations to its regulators, investors, or stakeholders

Capital Partners are encouraged to obtain independent legal, tax, and commercial advice before entering into a Capital Partner Agreement and on each material transaction.

---

## Important disclaimers

This page is general in nature and is provided for informational purposes. It is not, and does not constitute, an offer or solicitation to enter into any commercial arrangement, an offer of securities or any other regulated financial product, investment advice, tax advice, or legal advice. Forward-looking statements reflect TruMarket's views at the date of writing and may change without notice.

The Capital Partner role is offered only on a private, invitation-only basis pursuant to the Capital Partner Addendum to the Master Platform Terms & Conditions. Nothing on this page or elsewhere on the public-facing platform constitutes a public offering or general solicitation in any jurisdiction.

Participation in transactions on the TruMarket platform involves risk, including the risk of partial or total loss of contributed capital. No yield, fixed return, or guaranteed payout is offered or implied. Outcomes depend on the underlying commercial transactions and may be zero or negative.

This page has not been reviewed or approved by any financial-services or other regulatory authority.

For the full terms governing access to and use of the platform, see the Master Platform Terms & Conditions and the role-specific Addenda available to invited counterparties.
