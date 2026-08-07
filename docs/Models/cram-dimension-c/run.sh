#!/usr/bin/env bash
# Rebuild CRAM Dimension C from source tables. Fails loudly if any invariant breaks.
set -euo pipefail
cd "$(dirname "$0")"
echo "==> building node master"      && python3 build_nodes.py
echo "==> scoring"                   && python3 score_route.py
echo "==> validating"                && python3 validate.py
echo "==> contract tests"            && python3 test_score_deal.py
echo
echo "OK. Outputs: route-risk-table-v2.csv · route-risk-blueberry-by-variety.csv"
