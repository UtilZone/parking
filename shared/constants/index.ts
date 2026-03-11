// ─────────────────────────────────────────────────────────────────────────────
//  ParkSmart — Shared Constants  (Multi-Tenant)
//  Package: com.utilzone.parking
// ─────────────────────────────────────────────────────────────────────────────

// ── App Identity ──────────────────────────────────────────────────────────────

export const APP_PACKAGE   = 'com.utilzone.parking';
export const APP_NAME      = 'ParkSmart';
export const APP_VERSION   = '1.0.0';

// ── Firestore Collection Helpers ──────────────────────────────────────────────
// All tenant data lives under tenants/{tenantId}/...
// Use these helpers everywhere — never hardcode paths.

export const COL = {
  TENANTS:       'tenants',
  USERS:         'users',
  PLATFORM:      '_platform',
  COUNTERS:      '_counters',
  ANNOUNCEMENTS: '_platform/data/announcements',
} as const;

// Sub-collections under tenants/{tenantId}/
export const TENANT_COL = {
  PARKING_LOTS:  'parkingLots',
  SESSIONS:      'sessions',
  TRANSACTIONS:  'transactions',
  SHIFTS:        'shifts',
  ANOMALIES:     'anomalies',
  REPORTS:       'reports',
  SUBSCRIPTION:  'subscription',
} as const;

// Sub-collection under parkingLots/{lotId}/
export const LOT_COL = {
  SLOTS: 'slots',
} as const;

// Path builders
export const PATH = {
  tenant:       (tid: string)               => `tenants/${tid}`,
  lot:          (tid: string, lid: string)  => `tenants/${tid}/parkingLots/${lid}`,
  slot:         (tid: string, lid: string, sid: string) => `tenants/${tid}/parkingLots/${lid}/slots/${sid}`,
  session:      (tid: string, sid: string)  => `tenants/${tid}/sessions/${sid}`,
  transaction:  (tid: string, txid: string) => `tenants/${tid}/transactions/${txid}`,
  shift:        (tid: string, shid: string) => `tenants/${tid}/shifts/${shid}`,
  anomaly:      (tid: string, aid: string)  => `tenants/${tid}/anomalies/${aid}`,
  counter:      (tid: string, lid: string)  => `_counters/${tid}_${lid}`,
} as const;

// ── Storage Path Builders ─────────────────────────────────────────────────────

export const STORAGE = {
  entryPhoto:  (tid: string, sid: string)  => `tenants/${tid}/sessions/${sid}/entry.jpg`,
  cashProof:   (tid: string, txid: string) => `tenants/${tid}/cash-proofs/${txid}.jpg`,
  report:      (tid: string, fname: string)=> `tenants/${tid}/reports/${fname}`,
  avatar:      (uid: string)               => `avatars/${uid}.jpg`,
} as const;

// ── Cloud Function Names ──────────────────────────────────────────────────────

export const FN = {
  // Tenant onboarding
  REGISTER_TENANT:   'registerTenant',
  APPROVE_TENANT:    'approveTenant',
  SUSPEND_TENANT:    'suspendTenant',

  // User management
  ASSIGN_ROLE:       'assignRole',

  // Parking operations
  VEHICLE_ENTRY:     'vehicleEntry',
  VEHICLE_EXIT:      'vehicleExit',
  START_SHIFT:       'startShift',
  END_SHIFT:         'endShift',

  // Reports
  GENERATE_REPORT:   'generateReport',

  // Superadmin
  PUSH_ANNOUNCEMENT: 'pushAnnouncement',
  GET_PLATFORM_STATS:'getPlatformStats',
} as const;

// ── Vehicle Types ─────────────────────────────────────────────────────────────

export const VEHICLE_TYPES = [
  { value: 'car',   label: 'Car',   icon: '🚗', color: '#3B82F6' },
  { value: 'bike',  label: 'Bike',  icon: '🏍️', color: '#10B981' },
  { value: 'auto',  label: 'Auto',  icon: '🛺', color: '#F59E0B' },
  { value: 'truck', label: 'Truck', icon: '🚛', color: '#EF4444' },
] as const;

// ── Default Rate Card (₹/hr) — owner overrides per lot ───────────────────────

export const DEFAULT_RATE_CARD = { car: 30, bike: 10, auto: 20, truck: 60 } as const;

export const DEFAULT_PENALTY_RULES = {
  overstayThresholdHours: 4,
  penaltyPerHour:         20,
  maxDailyCharge:         500,
} as const;

// ── Subscription Plans ────────────────────────────────────────────────────────

export const PLANS = {
  trial: {
    planId: 'trial', displayName: 'Free Trial',
    priceMonthly: 0, maxLots: 1, maxAttendants: 2,
    features: ['1 parking location', '2 attendant accounts', 'Basic reports'],
    trialDays: 14,
  },
  basic: {
    planId: 'basic', displayName: 'Basic',
    priceMonthly: 999, maxLots: 3, maxAttendants: 10,
    features: ['Up to 3 locations', '10 attendant accounts', 'Full reports', 'Email support'],
  },
  pro: {
    planId: 'pro', displayName: 'Pro',
    priceMonthly: 2499, maxLots: 10, maxAttendants: 50,
    features: ['Up to 10 locations', '50 attendant accounts', 'Analytics', 'Priority support', 'Custom rate cards'],
  },
  enterprise: {
    planId: 'enterprise', displayName: 'Enterprise',
    priceMonthly: 0, maxLots: 999, maxAttendants: 999,
    features: ['Unlimited locations', 'Unlimited attendants', 'Dedicated support', 'Custom branding'],
  },
} as const;

// ── Thresholds ────────────────────────────────────────────────────────────────

export const DISCREPANCY_ALERT_THRESHOLD = 100;   // ₹
export const LONG_STAY_THRESHOLD_HOURS   = 8;
export const OVERFLOW_WARNING_PERCENT    = 100;    // warn when at 100% capacity

// ── Indian Plate Regex ────────────────────────────────────────────────────────

export const PLATE_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

// ── Token Prefix ──────────────────────────────────────────────────────────────

export const TOKEN_PREFIX = 'PKT';
