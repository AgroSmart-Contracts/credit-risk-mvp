# MVP: Agro Supply Chain Credit Risk Assessment
## Product Definition & Implementation Plan

---

## 1. MVP PRODUCT VISION

### What Does It Do?

**In One Sentence**: 
Automatically calculates a credit risk score (0-100) for each supply chain deal and recommends financing terms based on counterparty track record, deal structure, and product risk.

### Core Value Proposition:

✅ **For Platform**: Reduce default rates by 30-50% through data-driven credit decisions
✅ **For Finance Team**: Automate credit approval workflow from hours to minutes
✅ **For Users**: Get instant feedback on deal creditworthiness and recommended terms

### What's Out of Scope for MVP:

❌ External data APIs (weather, market prices, credit bureaus)
❌ Document OCR/extraction (manual for MVP)
❌ ML/AI models (rule-based scoring for MVP)
❌ Real-time monitoring (post-deal tracking)
❌ Complex financial products (just basic trade finance)

---

## 2. MVP WORKFLOW

### User Journey:

```
1. User Creates Deal
   ↓
2. System Prompts for Credit Risk Fields (new fields added)
   ↓
3. Auto-Calculates Risk Scores (4 sub-scores + overall)
   ↓
4. Displays Risk Assessment Dashboard
   ↓
5. Recommends Financing Terms
   ↓
6. Finance Team Reviews & Approves/Rejects/Adjusts
   ↓
7. Deal Proceeds with Approved Terms
```

### Key Screens/Interfaces:

**Screen 1: Enhanced Deal Creation Form**
- Existing fields (name, product, quantity, price, origin, destination)
- NEW: Payment Terms section
- NEW: Product Risk section
- NEW: Collateral section

**Screen 2: Risk Assessment Dashboard** (NEW)
- Overall Risk Score (0-100) with color coding
- 4 Sub-scores (Counterparty, Product, Trade Route, Deal Structure)
- Risk factors breakdown
- Recommended terms

**Screen 3: Finance Approval Queue** (NEW)
- List of pending deals sorted by risk score
- One-click approve/reject
- Override capability with justification

---

## 3. MVP FIELD REQUIREMENTS

### 3.1 DEAL LEVEL (10 new fields)

#### Payment Terms & Structure:
```
✓ paymentTerms (dropdown)
  - Options: "Cash in Advance", "30 days", "60 days", "90 days", "Letter of Credit", "Cash Against Documents"
  - Mandatory: YES
  - Default: "60 days"

✓ advancePaymentPct (number 0-100)
  - Label: "Advance Payment %"
  - Mandatory: NO
  - Default: 0
  - Validation: 0-100

✓ collateralType (dropdown)
  - Options: "None", "Inventory Pledge", "Warehouse Receipt", "Letter of Credit", "Bank Guarantee", "Personal Guarantee"
  - Mandatory: YES
  - Default: "None"

✓ collateralValueUSD (number)
  - Label: "Collateral Value (USD)"
  - Mandatory: IF collateralType != "None"
  - Default: 0

✓ insuranceCoverage (dropdown)
  - Options: "None", "Basic (Total Loss Only)", "Comprehensive", "All Risk"
  - Mandatory: YES
  - Default: "None"

✓ insuranceValueUSD (number)
  - Label: "Insurance Coverage Amount (USD)"
  - Mandatory: IF insuranceCoverage != "None"
  - Default: 0
```

#### Deal Context:
```
✓ priorDealsBetweenParties (number)
  - Label: "Previous Deals Between Buyer-Supplier"
  - Mandatory: NO
  - Default: 0
  - Auto-populated: YES (from platform history)

✓ relationshipAgeMonths (number)
  - Label: "Buyer-Supplier Relationship Age (months)"
  - Mandatory: NO
  - Default: 0
  - Auto-populated: YES (from platform history)

✓ contractType (dropdown)
  - Options: "Spot (Immediate)", "Forward Contract (Future Delivery)", "Seasonal Agreement"
  - Mandatory: YES
  - Default: "Spot (Immediate)"

✓ dealPurpose (dropdown)
  - Options: "Commercial Resale", "Processing/Manufacturing", "Direct Retail", "Export"
  - Mandatory: YES
  - Default: "Commercial Resale"
```

### 3.2 PRODUCT LEVEL (8 new fields)

#### Product Risk Characteristics:
```
✓ productCategory (dropdown)
  - Options: "Fresh Produce", "Frozen", "Dried", "Processed"
  - Mandatory: YES
  - Auto-suggest: Based on product name

✓ perishabilityClass (dropdown)
  - Options: "Ultra-Perishable (<7 days)", "Perishable (7-30 days)", "Semi-Perishable (>30 days)", "Non-Perishable"
  - Mandatory: YES
  - Auto-suggest: Based on product
  - Color code: Red (Ultra), Orange (Perishable), Yellow (Semi), Green (Non)

✓ shelfLifeDays (number)
  - Label: "Shelf Life (days from harvest)"
  - Mandatory: IF perishabilityClass includes "Perishable"
  - Default: null
  - Validation: 1-365

✓ coldChainRequired (boolean)
  - Label: "Requires Cold Chain?"
  - Mandatory: YES
  - Default: false

✓ temperatureRangeMin (number)
  - Label: "Min Storage Temp (°C)"
  - Mandatory: IF coldChainRequired = true
  - Default: null

✓ temperatureRangeMax (number)
  - Label: "Max Storage Temp (°C)"
  - Mandatory: IF coldChainRequired = true
  - Default: null

✓ qualityGrade (standardized)
  - Options: "Grade A / Class I", "Grade B / Class II", "Industrial / Processing Grade"
  - Mandatory: YES
  - Replaces: Current "quality" field (standardize existing)

✓ currentMarketPriceUSD (number)
  - Label: "Current Market Price (USD per unit)"
  - Mandatory: NO
  - Help text: "Check recent market prices to assess deal pricing"
  - Default: null
```

### 3.3 TRADE/LOGISTICS LEVEL (6 new fields)

#### Route & Terms:
```
✓ incoterm (dropdown) ⭐ CRITICAL
  - Options: "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"
  - Mandatory: YES
  - Default: "FOB"
  - Help text: Brief explanation of each term

✓ estimatedTransitDays (number)
  - Label: "Estimated Transit Time (days)"
  - Mandatory: YES
  - Default: null
  - Auto-suggest: Based on route if data available

✓ numberOfTransshipments (number)
  - Label: "Number of Transshipments"
  - Mandatory: YES
  - Default: 0
  - Validation: 0-5

✓ freightForwarder (text)
  - Label: "Freight Forwarder / Logistics Company"
  - Mandatory: NO
  - Default: null

✓ customsClearanceEstimatedDays (number)
  - Label: "Expected Customs Clearance Time (days)"
  - Mandatory: NO
  - Default: 3
  - Validation: 1-30

✓ routeRiskFlag (auto-calculated)
  - Based on: origin + destination + current events
  - Values: "Low", "Medium", "High"
  - Manual override: YES
```

### 3.4 COMPANY LEVEL (12 new fields)

#### Buyer Company:
```
✓ buyerYearsInBusiness (number)
  - Label: "Years in Business"
  - Mandatory: YES
  - Default: null
  - Validation: 0-200

✓ buyerImportLicenseValid (boolean)
  - Label: "Valid Import License?"
  - Mandatory: YES
  - Default: false

✓ buyerMonthlyPurchaseVolumeUSD (number)
  - Label: "Typical Monthly Purchase Volume (USD)"
  - Mandatory: NO
  - Default: null
  - Help text: "Helps assess if this deal is within normal capacity"

✓ buyerCreditRating (dropdown)
  - Options: "Excellent (AAA-AA)", "Good (A-BBB)", "Fair (BB-B)", "Poor (CCC or below)", "No Rating"
  - Mandatory: NO
  - Default: "No Rating"

✓ buyerPlatformDealsCompleted (auto-calculated)
  - Source: Platform transaction history
  - Count of "finished" deals

✓ buyerPlatformCompletionRate (auto-calculated)
  - Formula: (finished / (finished + cancelled)) * 100
  - Display: "%"
```

#### Supplier Company:
```
✓ supplierYearsInBusiness (number)
  - Label: "Years in Business"
  - Mandatory: YES
  - Default: null

✓ supplierExportLicenseValid (boolean)
  - Label: "Valid Export License?"
  - Mandatory: YES
  - Default: false

✓ supplierProductionCapacityMT (number)
  - Label: "Annual Production Capacity (MT)"
  - Mandatory: NO
  - Default: null
  - Help text: "Can they actually deliver this volume?"

✓ supplierQualityCertification (dropdown)
  - Options: "None", "GLOBALG.A.P.", "Organic Certified", "ISO 9001", "HACCP", "Multiple Certifications"
  - Mandatory: NO
  - Default: "None"

✓ supplierPlatformDealsCompleted (auto-calculated)
  - Source: Platform transaction history

✓ supplierPlatformOnTimeRate (auto-calculated)
  - Formula: (on-time deliveries / total deliveries) * 100
  - Display: "%"
  - Requires: Tracking actual vs. expected delivery dates
```

---

## 4. RISK SCORING METHODOLOGY (MVP)

### 4.1 Overall Risk Score Calculation

```
Overall Credit Risk Score (0-100) = Weighted Average:

- Counterparty Risk (40%):
  - Buyer Risk (20%)
  - Supplier Risk (20%)

- Product Risk (25%)

- Trade Route Risk (20%)

- Deal Structure Risk (15%)

SCALE:
- 80-100: Low Risk (Green) → Auto-approve up to $X
- 60-79: Medium Risk (Yellow) → Manual review required
- 40-59: High Risk (Orange) → Senior approval + stricter terms
- 0-39: Very High Risk (Red) → Reject or require collateral
```

### 4.2 Sub-Score Calculations

#### A) BUYER RISK SCORE (0-100)

```python
Base Score: 50 (neutral)

# Platform Track Record (if available) - Weight: 40%
if buyerPlatformDealsCompleted >= 10:
    +20 points
elif buyerPlatformDealsCompleted >= 5:
    +10 points
elif buyerPlatformDealsCompleted >= 1:
    +5 points

if buyerPlatformCompletionRate >= 95:
    +15 points
elif buyerPlatformCompletionRate >= 80:
    +10 points
elif buyerPlatformCompletionRate >= 60:
    +5 points
else:
    -10 points

# Years in Business - Weight: 25%
if buyerYearsInBusiness >= 10:
    +15 points
elif buyerYearsInBusiness >= 5:
    +10 points
elif buyerYearsInBusiness >= 2:
    +5 points
else:
    -5 points

# Credit Rating - Weight: 20%
if buyerCreditRating == "Excellent":
    +15 points
elif buyerCreditRating == "Good":
    +10 points
elif buyerCreditRating == "Fair":
    +5 points
elif buyerCreditRating == "Poor":
    -15 points

# Import License - Weight: 10%
if buyerImportLicenseValid:
    +10 points
else:
    -20 points (MAJOR RED FLAG for international trade)

# Capacity Check - Weight: 5%
if buyerMonthlyPurchaseVolumeUSD:
    if dealValue <= buyerMonthlyPurchaseVolumeUSD * 0.5:
        +5 points (within normal capacity)
    elif dealValue > buyerMonthlyPurchaseVolumeUSD * 2:
        -10 points (suspiciously large order)

MAX SCORE: 100
MIN SCORE: 0
```

#### B) SUPPLIER RISK SCORE (0-100)

```python
Base Score: 50 (neutral)

# Platform Track Record - Weight: 40%
if supplierPlatformDealsCompleted >= 10:
    +20 points
elif supplierPlatformDealsCompleted >= 5:
    +10 points

if supplierPlatformOnTimeRate >= 90:
    +15 points
elif supplierPlatformOnTimeRate >= 75:
    +10 points
elif supplierPlatformOnTimeRate < 50:
    -15 points

# Years in Business - Weight: 25%
if supplierYearsInBusiness >= 10:
    +15 points
elif supplierYearsInBusiness >= 5:
    +10 points
elif supplierYearsInBusiness < 2:
    -10 points (new supplier = higher risk)

# Certifications - Weight: 15%
if supplierQualityCertification == "Multiple Certifications":
    +15 points
elif supplierQualityCertification != "None":
    +10 points

# Export License - Weight: 15%
if supplierExportLicenseValid:
    +15 points
else:
    -25 points (CANNOT EXPORT!)

# Capacity Check - Weight: 5%
if supplierProductionCapacityMT:
    if dealQuantity <= supplierProductionCapacityMT / 12 * 0.3:  # <30% monthly capacity
        +5 points
    elif dealQuantity > supplierProductionCapacityMT / 12:  # >1 month production
        -15 points (can they deliver?)

MAX SCORE: 100
MIN SCORE: 0
```

#### C) PRODUCT RISK SCORE (0-100)

```python
Base Score: 70 (products generally lower risk than parties)

# Perishability - Weight: 40%
if perishabilityClass == "Non-Perishable":
    +20 points
elif perishabilityClass == "Semi-Perishable":
    +10 points
elif perishabilityClass == "Perishable":
    -5 points
elif perishabilityClass == "Ultra-Perishable":
    -15 points

# Cold Chain Requirement - Weight: 15%
if coldChainRequired:
    -10 points (higher complexity)
    if not temperatureRangeMin or not temperatureRangeMax:
        -5 additional (missing critical specs)

# Quality Grade - Weight: 15%
if qualityGrade == "Grade A / Class I":
    +10 points (premium = lower rejection risk)
elif qualityGrade == "Industrial / Processing Grade":
    +5 points (less picky buyers)

# Price vs. Market - Weight: 20%
if currentMarketPriceUSD:
    price_variance = (offerUnitPrice - currentMarketPriceUSD) / currentMarketPriceUSD
    if -0.05 <= price_variance <= 0.15:  # Within reasonable range
        +15 points
    elif price_variance > 0.30:  # Much higher than market
        -20 points (buyer unlikely to pay / commitment risk)
    elif price_variance < -0.30:  # Much lower than market
        -15 points (quality concerns / too good to be true)

# Product Standardization - Weight: 10%
if variety != "test" and quality != "test":
    +10 points (proper classification)

MAX SCORE: 100
MIN SCORE: 0
```

#### D) TRADE ROUTE RISK SCORE (0-100)

```python
Base Score: 70

# Transit Time - Weight: 30%
if perishabilityClass in ["Ultra-Perishable", "Perishable"]:
    if estimatedTransitDays <= 7:
        +20 points
    elif estimatedTransitDays <= 14:
        +10 points
    elif estimatedTransitDays > 21:
        -20 points (too long for perishables)
else:
    if estimatedTransitDays <= 30:
        +15 points
    elif estimatedTransitDays > 60:
        -10 points

# Transshipments - Weight: 25%
if numberOfTransshipments == 0:
    +20 points (direct route = best)
elif numberOfTransshipments == 1:
    +5 points
elif numberOfTransshipments >= 2:
    -15 points (high complexity)

# Incoterms Risk Allocation - Weight: 25%
incoterm_risk = {
    "EXW": -10,  # Buyer bears all risk (supplier safe, but buyer risk)
    "FCA": 0,
    "FAS": 0,
    "FOB": +10,  # Balanced
    "CFR": +5,
    "CIF": +15,  # Supplier insured, good for buyer
    "CPT": +5,
    "CIP": +15,
    "DAP": +20,  # Supplier delivers, best for buyer
    "DPU": +20,
    "DDP": +20
}
points += incoterm_risk.get(incoterm, 0)

# Route-specific risks - Weight: 20%
if routeRiskFlag == "Low":
    +15 points
elif routeRiskFlag == "Medium":
    +5 points
elif routeRiskFlag == "High":
    -20 points

# Customs Complexity - Weight: 10%
if customsClearanceEstimatedDays <= 3:
    +10 points
elif customsClearanceEstimatedDays > 7:
    -10 points

MAX SCORE: 100
MIN SCORE: 0
```

#### E) DEAL STRUCTURE RISK SCORE (0-100)

```python
Base Score: 60

# Payment Terms - Weight: 35%
payment_risk = {
    "Cash in Advance": +30,  # Zero risk
    "Letter of Credit": +25,  # Bank guaranteed
    "Cash Against Documents": +20,  # Documented
    "30 days": +10,
    "60 days": 0,
    "90 days": -15,
    "120+ days": -25
}
points += payment_risk.get(paymentTerms, 0)

# Advance Payment - Weight: 20%
if advancePaymentPct >= 50:
    +20 points
elif advancePaymentPct >= 25:
    +15 points
elif advancePaymentPct >= 10:
    +10 points
# 0% advance is neutral (no penalty)

# Collateral - Weight: 25%
if collateralType == "Letter of Credit":
    +25 points
elif collateralType == "Bank Guarantee":
    +20 points
elif collateralType == "Warehouse Receipt":
    +15 points
elif collateralType == "Inventory Pledge":
    +10 points
elif collateralType == "Personal Guarantee":
    +5 points

if collateralValueUSD >= investmentAmount:
    +5 additional points  # Fully collateralized

# Insurance - Weight: 15%
if insuranceCoverage == "All Risk":
    +15 points
elif insuranceCoverage == "Comprehensive":
    +10 points
elif insuranceCoverage == "Basic":
    +5 points

if insuranceValueUSD >= investmentAmount:
    +5 additional points  # Fully insured

# Relationship History - Weight: 10%
if priorDealsBetweenParties >= 10:
    +10 points
elif priorDealsBetweenParties >= 5:
    +7 points
elif priorDealsBetweenParties >= 1:
    +5 points
else:
    -10 points  # First-time relationship is riskier

MAX SCORE: 100
MIN SCORE: 0
```

---

## 5. RISK ASSESSMENT OUTPUT

### 5.1 Risk Dashboard Display

```
┌─────────────────────────────────────────────────────────────┐
│  DEAL CREDIT RISK ASSESSMENT                                │
│  Deal: #12345 - Fresh Mango (Peru → Netherlands)            │
│  Amount: $50,000                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OVERALL RISK SCORE                                         │
│                                                             │
│     ███████████░░░░░░░░░░░░░░░░░░░  72 / 100               │
│                                                             │
│     MEDIUM RISK  ⚠️                                         │
│     Manual Review Required                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RISK BREAKDOWN                                             │
│                                                             │
│  Counterparty Risk (40%):        78 / 100  ✅ Low          │
│    • Buyer Risk:                 82 / 100                   │
│    • Supplier Risk:              74 / 100                   │
│                                                             │
│  Product Risk (25%):             62 / 100  ⚠️ Medium       │
│                                                             │
│  Trade Route Risk (20%):         75 / 100  ✅ Low          │
│                                                             │
│  Deal Structure Risk (15%):      65 / 100  ⚠️ Medium       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  KEY RISK FACTORS                                           │
│                                                             │
│  ⚠️ CONCERNS:                                               │
│    • Ultra-perishable product (shelf life: 14 days)         │
│    • No advance payment                                     │
│    • 60-day payment terms without collateral                │
│    • First-time buyer-supplier relationship                 │
│                                                             │
│  ✅ MITIGATING FACTORS:                                     │
│    • Buyer has completed 12 deals (100% completion rate)    │
│    • Supplier has 8 deals (90% on-time delivery)            │
│    • Direct route (no transshipments)                       │
│    • CIF terms (supplier insures)                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RECOMMENDED FINANCING TERMS                                │
│                                                             │
│  Max Financing Amount:    $40,000 (80% of deal value)      │
│  Required Advance Payment: 20% ($10,000)                    │
│  Recommended Interest Rate: 8.5% APR                        │
│  Required Collateral:     Warehouse receipt OR              │
│                          Buyer guarantee for $40,000        │
│  Required Insurance:      Comprehensive coverage minimum    │
│  Credit Line:            Approve conditionally              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FINANCE TEAM ACTIONS                                       │
│                                                             │
│  [Approve with Recommended Terms]  [Modify Terms]  [Reject] │
│                                                             │
│  Override Justification: _____________________________      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Automated Recommendations Logic

```python
def get_financing_recommendations(overall_score, sub_scores, deal_value):
    """
    Returns recommended financing terms based on risk scores
    """
    
    # Financing Amount
    if overall_score >= 80:
        max_financing_pct = 100
    elif overall_score >= 70:
        max_financing_pct = 80
    elif overall_score >= 60:
        max_financing_pct = 70
    elif overall_score >= 50:
        max_financing_pct = 50
    else:
        max_financing_pct = 0  # Reject
    
    # Required Advance Payment
    if overall_score >= 75:
        required_advance_pct = 0
    elif overall_score >= 65:
        required_advance_pct = 10
    elif overall_score >= 55:
        required_advance_pct = 20
    else:
        required_advance_pct = 30
    
    # Interest Rate (base rate + risk premium)
    base_rate = 6.0  # Base rate
    if overall_score >= 80:
        risk_premium = 0.5
    elif overall_score >= 70:
        risk_premium = 1.5
    elif overall_score >= 60:
        risk_premium = 2.5
    elif overall_score >= 50:
        risk_premium = 4.0
    else:
        risk_premium = 6.0
    
    interest_rate = base_rate + risk_premium
    
    # Collateral Requirement
    if overall_score >= 80:
        collateral_required = "None"
    elif overall_score >= 70:
        collateral_required = "Optional (reduces rate by 0.5%)"
    elif overall_score >= 60:
        collateral_required = "Warehouse receipt OR buyer guarantee"
    elif overall_score >= 50:
        collateral_required = "Inventory pledge + insurance"
    else:
        collateral_required = "Full collateral (>100% deal value)"
    
    # Approval Recommendation
    if overall_score >= 75:
        decision = "AUTO-APPROVE"
        approval_level = "Automated"
    elif overall_score >= 60:
        decision = "MANUAL REVIEW"
        approval_level = "Credit Manager"
    elif overall_score >= 45:
        decision = "SENIOR APPROVAL"
        approval_level = "Credit Director"
    else:
        decision = "RECOMMEND REJECT"
        approval_level = "Executive Override Only"
    
    return {
        "max_financing_amount": deal_value * (max_financing_pct / 100),
        "max_financing_pct": max_financing_pct,
        "required_advance_pct": required_advance_pct,
        "required_advance_amount": deal_value * (required_advance_pct / 100),
        "interest_rate": interest_rate,
        "collateral_required": collateral_required,
        "decision": decision,
        "approval_level": approval_level
    }
```

---

## 6. DATA CAPTURE IMPLEMENTATION

### 6.1 Form Design - New "Credit Assessment" Section

**Add to Deal Creation Flow (After Basic Details)**:

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: CREDIT ASSESSMENT INFORMATION                     │
│  (Required for financing approval)                          │
└─────────────────────────────────────────────────────────────┘

[Tab 1: Payment Terms] [Tab 2: Product Details] [Tab 3: Route] [Tab 4: Parties]

─────────────────────────────────────────────────────────────
TAB 1: PAYMENT TERMS
─────────────────────────────────────────────────────────────

Payment Terms*: [Dropdown: 60 days ▼]
  Options: Cash in Advance, 30 days, 60 days, 90 days, Letter of Credit, Cash Against Documents

Advance Payment (%): [____] %
  ℹ️ Percentage paid before shipment (reduces financing risk)

Contract Type*: [Dropdown: Spot (Immediate) ▼]

Incoterms*: [Dropdown: FOB ▼]
  ℹ️ Defines when risk transfers from seller to buyer
  [What's this?] → Tooltip with brief explanation

─── Collateral (Optional but Recommended) ───

Collateral Type: [Dropdown: None ▼]
  Options: None, Inventory Pledge, Warehouse Receipt, Letter of Credit, Bank Guarantee

[IF Collateral Type != "None"]
  Collateral Value (USD): [$________]

─── Insurance ───

Insurance Coverage*: [Dropdown: None ▼]
  Options: None, Basic (Total Loss Only), Comprehensive, All Risk

[IF Insurance != "None"]
  Insurance Value (USD): [$________]

─────────────────────────────────────────────────────────────
TAB 2: PRODUCT DETAILS
─────────────────────────────────────────────────────────────

Product Category*: [Dropdown: Fresh Produce ▼]
  Auto-detected based on your product name

Perishability*: [Dropdown: Perishable (7-30 days) ▼]
  ⚠️ Affects financing terms and risk assessment

[IF Perishable]
  Shelf Life (days from harvest): [____] days

Cold Chain Required?: [✓] Yes  [ ] No

[IF Cold Chain = Yes]
  Storage Temperature: Min: [____]°C  Max: [____]°C

Quality Grade*: [Dropdown: Grade A / Class I ▼]

Current Market Price (USD/unit): [$________] (Optional)
  ℹ️ Helps validate deal pricing
  [Check Market Price] → Link to reference sources

─────────────────────────────────────────────────────────────
TAB 3: ROUTE & LOGISTICS
─────────────────────────────────────────────────────────────

Estimated Transit Time*: [____] days
  Auto-suggested: 18 days (based on Peru → Netherlands route)

Number of Transshipments*: [____]
  Direct shipping: 0
  One stop: 1

Freight Forwarder: [____________________] (Optional)

Expected Customs Clearance: [3] days
  ℹ️ Typical clearance time at destination

Route Risk Assessment: [Auto: Medium ▼]
  Based on origin-destination pair
  [ ] Manual override

─────────────────────────────────────────────────────────────
TAB 4: COMPANY INFORMATION
─────────────────────────────────────────────────────────────

─── Buyer Company ───

Years in Business*: [____] years

Valid Import License?: [✓] Yes  [ ] No
  ⚠️ Required for international deals

Monthly Purchase Volume (USD): [$________] (Optional)
  ℹ️ Typical monthly purchasing capacity

Credit Rating: [Dropdown: No Rating ▼] (Optional)

Platform History:
  • Completed Deals: 12 (auto-populated)
  • Completion Rate: 100% (auto-populated)
  • Average Payment Delay: 0 days (auto-populated)

─── Supplier Company ───

Years in Business*: [____] years

Valid Export License?: [✓] Yes  [ ] No
  ⚠️ Required for exports

Annual Production Capacity (MT): [____] MT (Optional)

Quality Certifications: [Dropdown: None ▼]
  Options: None, GLOBALG.A.P., Organic, ISO 9001, HACCP, Multiple

Platform History:
  • Completed Deals: 8 (auto-populated)
  • On-Time Delivery Rate: 90% (auto-populated)
  • Quality Rejection Rate: 5% (auto-populated)

─────────────────────────────────────────────────────────────

Relationship History:
  • Previous Deals Between These Parties: 0 (auto-populated)
  • Relationship Age: New relationship (auto-populated)

─────────────────────────────────────────────────────────────

[Save & Calculate Risk Assessment]

```

### 6.2 Auto-Population Strategy

**Fields Auto-Populated from Existing Data**:
1. `priorDealsBetweenParties` - Query database for buyer-supplier pair
2. `relationshipAgeMonths` - Calculate from first deal date
3. `buyerPlatformDealsCompleted` - Count buyer's finished deals
4. `buyerPlatformCompletionRate` - Calculate from buyer's history
5. `supplierPlatformDealsCompleted` - Count supplier's finished deals
6. `supplierPlatformOnTimeRate` - Calculate if delivery dates tracked

**Smart Defaults**:
1. `productCategory` - Suggest based on product name matching
2. `perishabilityClass` - Suggest based on product type
3. `estimatedTransitDays` - Lookup table for route pairs
4. `customsClearanceEstimatedDays` - Default 3, or country-specific
5. `routeRiskFlag` - Default "Low" unless flagged routes

---

## APPENDIX: EXAMPLE DEAL SCORING

### Deal Example: Fresh Blueberries Peru → USA

**Input Data**:
- Deal Value: $100,000
- Product: Fresh Blueberries
- Quantity: 5,000 kg
- Origin: Peru → Destination: USA
- Buyer: 15 years in business, 20 deals completed, 100% completion rate
- Supplier: 8 years in business, 12 deals completed, 85% on-time rate
- Payment Terms: 60 days, 0% advance
- Incoterms: FOB
- Perishability: Ultra-perishable (14 days shelf life)
- Transit: 12 days, direct route
- Insurance: Comprehensive

**Calculated Scores**:
- Buyer Risk: 88 (Excellent track record, established business)
- Supplier Risk: 72 (Good but some delays)
- Product Risk: 58 (Ultra-perishable is risky)
- Route Risk: 82 (Good route, reasonable transit)
- Deal Structure: 55 (No advance, no collateral)

**Overall Score**: 72 (Medium Risk)

**Recommendation**:
- Max Financing: $80,000 (80%)
- Required Advance: 10% ($10,000)
- Interest Rate: 7.5%
- Collateral: Warehouse receipt recommended
- Decision: Manual review required

---

**Document Version**: MVP 1.0
**Target Launch**: 6 weeks from approval
**Next Review**: After 100 deals scored
