# Changelog

All notable changes to this project are documented in this file.

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
