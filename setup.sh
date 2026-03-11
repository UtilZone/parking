#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ParkSmart — Bootstrap & Deploy Script
#  com.utilzone.parking
#
#  Usage:
#    chmod +x setup.sh
#    ./setup.sh            # install all deps
#    ./setup.sh deploy     # install + full deploy
#    ./setup.sh functions  # deploy functions only
# ─────────────────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { echo -e "\n\033[1;33m▶ $1\033[0m"; }
ok()   { echo -e "\033[1;32m✅ $1\033[0m"; }
fail() { echo -e "\033[1;31m❌ $1\033[0m"; exit 1; }

# ── 1. Install all dependencies ───────────────────────────────────────────────

install_all() {
  log "Installing Cloud Functions dependencies…"
  cd "$ROOT/functions" && npm install && cd "$ROOT"
  ok "Functions deps installed"

  log "Installing Owner Dashboard dependencies…"
  cd "$ROOT/apps/owner-dashboard" && npm install && cd "$ROOT"
  ok "Owner Dashboard deps installed"

  log "Installing Super Admin Panel dependencies…"
  cd "$ROOT/apps/superadmin-panel" && npm install && cd "$ROOT"
  ok "Super Admin Panel deps installed"

  log "Installing Attendant App dependencies…"
  cd "$ROOT/apps/attendant" && npm install && cd "$ROOT"
  ok "Attendant App deps installed"

  log "Installing Customer App dependencies…"
  cd "$ROOT/apps/customer" && npm install && cd "$ROOT"
  ok "Customer App deps installed"
}

# ── 2. Build web apps ─────────────────────────────────────────────────────────

build_web() {
  log "Building Owner Dashboard…"
  cd "$ROOT/apps/owner-dashboard" && npm run build && cd "$ROOT"
  ok "Owner Dashboard built → apps/owner-dashboard/build/"

  log "Building Super Admin Panel…"
  cd "$ROOT/apps/superadmin-panel" && npm run build && cd "$ROOT"
  ok "Super Admin Panel built → apps/superadmin-panel/build/"
}

# ── 3. Full Firebase deploy ───────────────────────────────────────────────────

deploy_all() {
  log "Deploying Firestore rules + indexes…"
  firebase deploy --only firestore
  ok "Firestore deployed"

  log "Deploying Storage rules…"
  firebase deploy --only storage
  ok "Storage rules deployed"

  log "Building + deploying Cloud Functions…"
  cd "$ROOT/functions" && npm run build && cd "$ROOT"
  firebase deploy --only functions
  ok "Cloud Functions deployed"

  build_web

  log "Deploying web apps to Firebase Hosting…"
  firebase deploy --only hosting
  ok "Hosting deployed"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "${1:-install}" in
  install)   install_all ;;
  deploy)    install_all && deploy_all ;;
  functions) cd "$ROOT/functions" && npm install && npm run build && cd "$ROOT" && firebase deploy --only functions ;;
  hosting)   build_web && firebase deploy --only hosting ;;
  rules)     firebase deploy --only firestore,storage ;;
  *)
    echo "Usage: ./setup.sh [install|deploy|functions|hosting|rules]"
    exit 1
    ;;
esac

echo ""
ok "Done!"
