#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/setup-github-secrets.sh
#  Generates the Firebase CI token and prints all secrets you need to add
#  to GitHub → Settings → Secrets and variables → Actions
# ─────────────────────────────────────────────────────────────────────────────

set -e
RED='\033[0;31m'; AMBER='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'

echo ""
echo -e "${AMBER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${AMBER}  ParkSmart — GitHub Secrets Setup${NC}"
echo -e "${AMBER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This script will help you generate the values for GitHub Actions secrets."
echo "Run it once from your terminal after completing Firebase setup."
echo ""

# ── Step 1: Firebase CI Token ─────────────────────────────────────────────────
echo -e "${GREEN}Step 1: Generating Firebase CI Token...${NC}"
echo "A browser window will open for authentication."
echo ""
FIREBASE_TOKEN=$(firebase login:ci --no-localhost 2>/dev/null || echo "FAILED")

if [ "$FIREBASE_TOKEN" = "FAILED" ]; then
  echo -e "${RED}Could not generate token automatically.${NC}"
  echo "Run manually: firebase login:ci"
  FIREBASE_TOKEN="<run: firebase login:ci>"
fi

echo ""

# ── Step 2: Firebase Service Account ─────────────────────────────────────────
echo -e "${GREEN}Step 2: Creating Firebase Service Account JSON...${NC}"
echo "Go to: Firebase Console → Project Settings → Service accounts"
echo "Click 'Generate new private key' → download the JSON file"
echo "The content of that JSON file = value of FIREBASE_SERVICE_ACCOUNT secret"
echo ""

# ── Step 3: Print all secrets ─────────────────────────────────────────────────
echo -e "${AMBER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${AMBER}  Add these secrets in GitHub:${NC}"
echo -e "${AMBER}  Repository → Settings → Secrets and variables → Actions → New repository secret${NC}"
echo -e "${AMBER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Secret Name                    │ Where to find the value"
echo "───────────────────────────────┼─────────────────────────────────────────"
echo "FIREBASE_PROJECT_ID            │ Firebase Console → Project Settings → Project ID"
echo "FIREBASE_TOKEN                 │ $FIREBASE_TOKEN"
echo "FIREBASE_SERVICE_ACCOUNT       │ Service account JSON file content (entire JSON)"
echo "FIREBASE_API_KEY               │ Firebase Console → Project Settings → Web app → apiKey"
echo "FIREBASE_MESSAGING_SENDER_ID   │ Firebase Console → Project Settings → Web app → messagingSenderId"
echo "FIREBASE_APP_ID_WEB            │ Firebase Console → Project Settings → Web app → appId"
echo ""
echo -e "${GREEN}Once all secrets are added, push to main to trigger deployment.${NC}"
echo ""
