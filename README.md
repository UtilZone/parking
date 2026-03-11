# ⬡ ParkSmart
**Multi-tenant Digital Parking Management SaaS** — `com.utilzone.parking`

## Applications
| App | Platform | Package | Description |
|-----|----------|---------|-------------|
| Attendant | Android (Expo) | `com.utilzone.parking.attendant` | Entry/exit, shift, OCR plate scan |
| Customer  | Android (Expo) | `com.utilzone.parking.customer`  | Live token + QR, history |
| Owner Dashboard | React Web | Firebase Hosting | Lots, attendants, reports |
| Super Admin Panel | React Web | Firebase Hosting | Tenant approval, billing |

## Quick Start
1. See `ParkSmart-Setup-Guide.docx` for full Firebase setup
2. Fill firebase.ts config in all 4 apps
3. `./setup.sh deploy`
4. `node scripts/create-superadmin.js admin@utilzone.com <UID>`
5. `cd apps/attendant && eas build -p android --profile preview`

## Local Dev
```bash
firebase emulators:start
node scripts/seed-emulator.js  # seeds test data
# open http://localhost:4000
```
Test users after seed: `admin@utilzone.com/Admin@1234`, `owner@shivajinagarpk.com/Owner@1234`

## CI/CD
Push to `main` → GitHub Actions auto-deploys Functions + Hosting.
See `.github/workflows/deploy.yml` and run `scripts/setup-github-secrets.sh`.
