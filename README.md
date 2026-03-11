# ParkSmart 🅿️
### com.utilzone.parking

**Multi-tenant, Firebase-powered parking management platform**
Sell to multiple parking owners. Each owner manages multiple locations.
Two parking modes: slot-based and capacity-based. Zero third-party dependencies.

---

## Architecture Overview

```
utilzone Super Admin (you)
      │
      ├── Tenant A: "Shivaji Nagar Parking Pvt Ltd"
      │       ├── Lot 1: MG Road         [slot_based,    50 slots]
      │       ├── Lot 2: Station Road    [capacity_based, 80 max]
      │       └── Attendants: Ramesh, Arun (select lot at shift start)
      │
      ├── Tenant B: "City Park Solutions"
      │       ├── Lot 1: FC Road         [capacity_based, 120 max]
      │       └── Attendant: Suresh
      │
      └── Tenant C: ...
```

### Firestore Data Structure
```
tenants/{tenantId}/
    ├── (tenant doc: businessName, ownerUid, status, plan...)
    ├── parkingLots/{lotId}/
    │       ├── (lot doc: parkingMode, totalCapacity, currentCount, rateCard...)
    │       └── slots/{slotId}/          ← only if parkingMode = "slot_based"
    ├── sessions/{sessionId}/
    ├── transactions/{txnId}/            ← IMMUTABLE after creation
    ├── shifts/{shiftId}/
    ├── anomalies/{anomalyId}/
    └── reports/{reportId}/

users/{uid}/                             ← global, role + tenantId as custom claims
_platform/                               ← superadmin only (stats, announcements)
_counters/{tenantId}_{lotId}            ← atomic token counter
```

---

## Project Structure

```
parksmart/
├── firebase.json
├── firestore.rules                      # Multi-tenant security rules
├── firestore.indexes.json
├── storage.rules
│
├── shared/
│   ├── types/index.ts                   # All TypeScript types
│   ├── constants/index.ts               # Collection paths, plans, config
│   └── utils/index.ts                   # Fare calc, plate helpers, formatters
│
├── functions/src/
│   ├── index.ts                         # Exports all functions
│   ├── tenant.ts                        # registerTenant, approveTenant, suspendTenant,
│   │                                    # assignRole, pushAnnouncement, getPlatformStats
│   └── parking.ts                       # vehicleEntry, vehicleExit, startShift, endShift,
│                                        # onTransactionCreated, generateReport,
│                                        # scheduledAnomalyCheck
│
└── apps/
    ├── attendant/                       # React Native (Expo) — com.utilzone.parking.attendant
    │   ├── app.json
    │   └── src/
    │       ├── config/firebase.ts
    │       ├── hooks/useAuth.ts         # Phone OTP, reads tenantId + assignedLotIds from claims
    │       └── screens/
    │           ├── ShiftStartScreen.tsx # Lot selector (multi-location support)
    │           └── VehicleEntryScreen.tsx # Both parking modes
    │
    ├── customer/                        # React Native (Expo) — com.utilzone.parking.customer
    │   └── (token view, history, receipts)
    │
    ├── owner-dashboard/                 # React web — com.utilzone.parking.owner
    │   └── src/pages/
    │       └── OwnerDashboardPage.tsx  # Multi-lot location switcher, live stats
    │
    └── superadmin-panel/               # React web — utilzone internal only
        └── src/pages/
            └── SuperAdminDashboard.tsx # Approve tenants, platform stats, announcements
```

---

## Parking Modes

### `slot_based`
- Owner defines physical slots (A-01, B-03...)
- Attendant picks a specific slot at entry
- Token shows slot number
- Live slot map visible to owner

### `capacity_based`
- Owner sets max vehicles (e.g., 50)
- No slot numbers — vehicles park anywhere
- System tracks `currentCount` (increments/decrements atomically)
- At capacity: returns warning to attendant
- If `allowOverflow: true`: attendant can confirm override
- Overflow entries create an anomaly for owner review

---

## User Roles & Custom Claims

| Role | Claims | Access Scope |
|---|---|---|
| `superadmin` | `{ role: 'superadmin' }` | All tenants, platform data |
| `owner` | `{ role: 'owner', tenantId }` | Own tenant only |
| `attendant` | `{ role: 'attendant', tenantId }` | Own shift/sessions within tenant |
| `customer` | `{ role: 'customer', tenantId? }` | Own sessions only |

---

## Setup Guide

### 1. Create Firebase Project
```
console.firebase.google.com → Add project → "parksmart-prod"
Enable: Authentication, Firestore, Storage, Functions, Hosting (2 targets), Remote Config
```

### 2. Firebase Hosting Targets
```bash
firebase target:apply hosting owner-dashboard  YOUR_OWNER_HOSTING_ID
firebase target:apply hosting superadmin-panel YOUR_ADMIN_HOSTING_ID
```

### 3. Update Firebase Config
Replace placeholders in all `src/config/firebase.ts` files with your actual config.

### 4. Deploy
```bash
# Install function deps
cd functions && npm install && npm run build && cd ..

# Deploy everything
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting:owner-dashboard
firebase deploy --only hosting:superadmin-panel
```

### 5. Create Super Admin Account
```bash
# In Firebase Console → Authentication → Add user
# Note the UID, then in a Node.js script:

const admin = require('firebase-admin');
admin.initializeApp();
await admin.auth().setCustomUserClaims('SUPERADMIN_UID', { role: 'superadmin' });
await admin.firestore().collection('users').doc('SUPERADMIN_UID').set({
  uid: 'SUPERADMIN_UID', name: 'utilzone Admin',
  role: 'superadmin', isActive: true,
  createdAt: admin.firestore.Timestamp.now(),
});
```

### 6. Run Mobile Apps
```bash
cd apps/attendant
npm install
npx expo start          # Scan with Expo Go on Android
```

### 7. Onboard First Owner (Self-Registration Flow)
1. Owner downloads app, taps "Register Business"
2. Calls `registerTenant` function → creates tenant in `pending_approval`
3. Super Admin sees it in panel → reviews → approves with a plan
4. Owner gets FCM notification: "Account Approved!"
5. Owner logs into dashboard, creates parking lots, adds attendants

---

## Cloud Functions Reference

### Tenant Operations
| Function | Caller | Purpose |
|---|---|---|
| `registerTenant` | Owner (new) | Self-register, creates pending tenant |
| `approveTenant` | SuperAdmin | Approve + set plan |
| `suspendTenant` | SuperAdmin | Suspend with reason + FCM alert to owner |
| `assignRole` | Owner | Give attendant access to their lots |
| `pushAnnouncement` | SuperAdmin | FCM to all users, stored in Firestore |
| `getPlatformStats` | SuperAdmin | Tenant counts, plan breakdown |

### Parking Operations
| Function | Caller | Purpose |
|---|---|---|
| `vehicleEntry` | Attendant | Entry for both modes, overflow confirmation flow |
| `vehicleExit` | Attendant | Exit, fare calc (server-side), slot/count release |
| `startShift` | Attendant | Open shift at selected lot |
| `endShift` | Attendant | Close shift + reconciliation, flag discrepancies |
| `onTransactionCreated` | Firestore trigger | FCM receipt, revenue counter update |
| `generateReport` | Owner | Date-range aggregation per lot or all lots |
| `scheduledAnomalyCheck` | Daily 1AM IST | Long-stay flags, daily counter reset |

---

## Subscription Plans

| Plan | Price/month | Max Lots | Max Attendants |
|---|---|---|---|
| Trial (14 days) | Free | 1 | 2 |
| Basic | ₹999 | 3 | 10 |
| Pro | ₹2,499 | 10 | 50 |
| Enterprise | Custom | Unlimited | Unlimited |

Plan limits enforced in `registerTenant` and `vehicleEntry` (lot count check).

---

## Anti-Leakage Security

1. **Fare is server-computed only** — `vehicleExit` calculates charge; client never sends amount
2. **Transactions are immutable** — Firestore rules block all `update`/`delete`
3. **Cash requires photo proof** — `vehicleExit` rejects cash without `cashPhotoUrl`
4. **Attendant scope** — Can only access their own tenant + shift data
5. **Shift reconciliation** — `endShift` compares expected vs actual, flags > ₹100 gap
6. **Overflow tracking** — Capacity overrides create anomalies for owner review
7. **Tenant isolation** — All data under `tenants/{tenantId}/`, Firestore rules enforce at path level

---

## App Package Names

| App | Android Package | iOS Bundle |
|---|---|---|
| Attendant | `com.utilzone.parking.attendant` | `com.utilzone.parking.attendant` |
| Customer | `com.utilzone.parking.customer` | `com.utilzone.parking.customer` |
| Owner Dashboard | Web app (Firebase Hosting) | — |
| Super Admin Panel | Web app (Firebase Hosting) | — |

---

*Built by utilzone · 100% Firebase · Zero third-party services*
