# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Pre-harvest workspace for bank crop loans (English / Spanish): dashboard with portfolio map, inbox, decisions, alerts and method pages, and a loan file page that leads with the money (exposure, money at risk, repayment, risk score)
- Pre-harvest scoring (Production / Operator / Structure, Counterparty from M3), crop-stage tranches with release conditions, and monitoring of crop health, weather and water, market and M3 takeout
- TruMarket updates with the financial impact of each signal, a credit timeline, risk details and a campaign replay with CSV decision log
- `GET /api/pre-harvest-data`: live NASA MODIS, Sentinel-2, Open-Meteo and NOAA readings per parcel
- Shared sidebar for the internal app and the pre-harvest workspace

### Changed

- Colours follow the TruMarket palette from `trumarket/web`
- Favicon is the TruMarket logo
- Score gauge animates from the current value instead of from 0

### Fixed

- Coface extraction never read fields such as "Country risk rating: A2" (escaped `\s` in template-string regexes)
- Two platform deals shared the id `plat-69d3e6fb`; ids now fall back to the full Mongo id on collision

## [1.0.0] - 2026-07-10

First production-ready MVP release.

### Added

- CRAM transaction structure scoring (Sub-A + Sub-D composite)
- Peru market intel integration (supplier RUC lookup, route/price/relationship signals)
- Market intel API (`api/market-intel-rate.py`) and dev middleware proxy
- Processing mascot during document analysis
- Counterparty and structure confirmation fields with sensible defaults
- Purchase total extraction from uploaded purchase orders

### Fixed

- Deal value (USD) detection on TM sales contracts misclassified as purchase orders
- License validity defaults to valid when not disclosed in documents

### Changed

- Risk scoring dimensions wired to market intel when supplier RUC is available
- Document ingestion fetches market intel before running assessment
