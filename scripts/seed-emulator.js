#!/usr/bin/env node
/**
 * scripts/seed-emulator.js
 *
 * Seeds the local Firebase emulator with realistic test data for development.
 * Run AFTER starting emulators: firebase emulators:start
 *
 * Usage:
 *   node scripts/seed-emulator.js
 */

const admin = require('firebase-admin');

// Connect to local emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-parksmart' });
const db   = admin.firestore();
const auth = admin.auth();

const now = admin.firestore.Timestamp.now();
const hoursAgo = (h) => admin.firestore.Timestamp.fromMillis(Date.now() - h * 3600000);

async function seed() {
  console.log('🌱 Seeding ParkSmart emulator...\n');

  // ── 1. Super Admin user ───────────────────────────────────────────────────
  console.log('Creating super admin...');
  const adminUser = await auth.createUser({
    uid:          'superadmin-001',
    email:        'admin@utilzone.com',
    password:     'Admin@1234',
    displayName:  'Super Admin',
  }).catch(() => auth.getUser('superadmin-001'));

  await auth.setCustomUserClaims('superadmin-001', { role: 'superadmin' });
  await db.doc('users/superadmin-001').set({
    uid: 'superadmin-001', name: 'Super Admin', email: 'admin@utilzone.com',
    phone: '', role: 'superadmin', isActive: true, createdAt: now,
  });

  // ── 2. Owner user + Tenant ────────────────────────────────────────────────
  console.log('Creating owner + tenant...');
  const ownerUser = await auth.createUser({
    uid:         'owner-001',
    email:       'owner@shivajinagarpk.com',
    password:    'Owner@1234',
    displayName: 'Rajesh Patil',
  }).catch(() => auth.getUser('owner-001'));

  const tenantRef = db.doc('tenants/tenant-001');
  await tenantRef.set({
    tenantId:     'tenant-001',
    businessName: 'Shivaji Nagar Parking Pvt Ltd',
    ownerUid:     'owner-001',
    ownerName:    'Rajesh Patil',
    ownerPhone:   '+919876543210',
    ownerEmail:   'owner@shivajinagarpk.com',
    status:       'active',
    plan:         'pro',
    subscriptionStart: now,
    subscriptionEnd:   admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 86400000),
    registrationNote: 'Operating 2 lots in Shivaji Nagar, Pune since 2019.',
    createdAt: now, approvedAt: now,
  });

  await auth.setCustomUserClaims('owner-001', { role: 'owner', tenantId: 'tenant-001' });
  await db.doc('users/owner-001').set({
    uid: 'owner-001', name: 'Rajesh Patil',
    email: 'owner@shivajinagarpk.com', phone: '+919876543210',
    role: 'owner', tenantId: 'tenant-001', isActive: true, createdAt: now,
  });

  // ── 3. Parking Lots ───────────────────────────────────────────────────────
  console.log('Creating parking lots...');

  // Lot A — Capacity-based
  const lotARef = db.doc('tenants/tenant-001/parkingLots/lot-001');
  await lotARef.set({
    lotId: 'lot-001', tenantId: 'tenant-001',
    name: 'MG Road Open Parking', address: '15, MG Road', city: 'Pune',
    geoLocation: { lat: 18.5204, lng: 73.8567 },
    parkingMode: 'capacity_based',
    totalCapacity: 50, currentCount: 12,
    allowOverflow: true, isActive: true,
    rateCard:     { car: 30, bike: 10, auto: 20, truck: 60 },
    penaltyRules: { overstayThresholdHours: 4, penaltyPerHour: 20, maxDailyCharge: 500 },
    revenue: { today: 1240, month: 38600, total: 412000 },
    createdAt: now,
  });

  // Lot B — Slot-based
  const lotBRef = db.doc('tenants/tenant-001/parkingLots/lot-002');
  await lotBRef.set({
    lotId: 'lot-002', tenantId: 'tenant-001',
    name: 'Station Road Covered Parking', address: '8, Station Road', city: 'Pune',
    geoLocation: { lat: 18.5286, lng: 73.8741 },
    parkingMode: 'slot_based',
    totalSlots: 24, isActive: true,
    allowOverflow: false,
    rateCard:     { car: 40, bike: 15, auto: 25, truck: 80 },
    penaltyRules: { overstayThresholdHours: 6, penaltyPerHour: 30, maxDailyCharge: 800 },
    revenue: { today: 960, month: 29400, total: 298000 },
    createdAt: now,
  });

  // Slots for Lot B
  const slotBatch = db.batch();
  for (let i = 1; i <= 24; i++) {
    const slotId = `A-${String(i).padStart(2, '0')}`;
    const isOccupied = i <= 8;
    slotBatch.set(db.doc(`tenants/tenant-001/parkingLots/lot-002/slots/${slotId}`), {
      slotId, lotId: 'lot-002', tenantId: 'tenant-001',
      status:           isOccupied ? 'occupied' : 'free',
      currentSessionId: isOccupied ? `session-slot-${i}` : null,
      vehicleType:      isOccupied ? 'car' : null,
      lastUpdated:      now,
    });
  }
  await slotBatch.commit();

  // ── 4. Attendant users ────────────────────────────────────────────────────
  console.log('Creating attendants...');
  for (const [uid, name, phone, lotIds] of [
    ['att-001', 'Suresh Kamble', '+919823456781', ['lot-001', 'lot-002']],
    ['att-002', 'Priya More',   '+919823456782', ['lot-001']],
  ]) {
    await auth.createUser({ uid, displayName: name }).catch(() => {});
    await auth.setCustomUserClaims(uid, { role: 'attendant', tenantId: 'tenant-001', assignedLotIds: lotIds });
    await db.doc(`users/${uid}`).set({
      uid, name, phone, email: '', role: 'attendant',
      tenantId: 'tenant-001', assignedLotIds: lotIds,
      isActive: true, createdAt: now,
    });
  }

  // ── 5. Active shift + sessions (Lot A) ───────────────────────────────────
  console.log('Creating active shift and sessions...');
  await db.doc('tenants/tenant-001/shifts/shift-001').set({
    shiftId: 'shift-001', tenantId: 'tenant-001', lotId: 'lot-001',
    attendantId: 'att-001', attendantName: 'Suresh Kamble',
    status: 'active', startTime: hoursAgo(4),
    expectedRevenue: 0, collectedRevenue: 720,
  });

  // Active sessions
  const vehicles = [
    ['MH12AB1234', 'car'], ['MH14CD5678', 'bike'], ['MH12XY9012', 'auto'],
    ['MH14EF3456', 'car'], ['MH12GH7890', 'car'],
  ];
  for (let i = 0; i < vehicles.length; i++) {
    const [plate, vtype] = vehicles[i];
    const sessionId = `session-00${i+1}`;
    const token = `PKT-${String(i+1).padStart(4,'0')}`;
    const entryHours = Math.random() * 3 + 0.5;
    await db.doc(`tenants/tenant-001/sessions/${sessionId}`).set({
      sessionId, tenantId: 'tenant-001', lotId: 'lot-001', shiftId: 'shift-001',
      tokenNumber: token, qrCodeData: `PSK:${sessionId}:tenant-001:lot-001:${Date.now()}`,
      plateNumber: plate, vehicleType: vtype,
      parkingMode: 'capacity_based',
      attendantId: 'att-001', customerId: null,
      entryTime: hoursAgo(entryHours),
      status: 'active', chargeAmount: null, paymentMethod: null,
    });
  }

  // Completed sessions for today
  for (let i = 0; i < 8; i++) {
    const sessionId = `session-done-${i+1}`;
    const amount    = [30, 60, 45, 90, 30, 120, 60, 45][i];
    const method    = ['UPI','Cash','UPI','Card','Cash','UPI','UPI','Cash'][i];
    await db.doc(`tenants/tenant-001/sessions/${sessionId}`).set({
      sessionId, tenantId: 'tenant-001', lotId: 'lot-001', shiftId: 'shift-001',
      tokenNumber: `PKT-${String(i+10).padStart(4,'0')}`,
      plateNumber: `MH12ZZ${1000+i}`, vehicleType: 'car',
      parkingMode: 'capacity_based',
      attendantId: 'att-001', customerId: null,
      entryTime:  hoursAgo(5 - i * 0.4),
      exitTime:   hoursAgo(4 - i * 0.3),
      durationMinutes: Math.floor(Math.random() * 90 + 30),
      chargeAmount: amount, paymentMethod: method,
      status: 'completed',
    });
    await db.doc(`tenants/tenant-001/transactions/txn-${i+1}`).set({
      txnId: `txn-${i+1}`, tenantId: 'tenant-001', lotId: 'lot-001',
      sessionId, attendantId: 'att-001', amount, paymentMethod: method,
      timestamp: hoursAgo(4 - i * 0.3), isVoided: false,
    });
  }

  // ── 6. Platform stats doc ─────────────────────────────────────────────────
  console.log('Creating platform stats...');
  await db.doc('_platform/stats').set({
    totalTenants: 1, activeTenants: 1,
    planBreakdown: { trial: 0, basic: 0, pro: 1, enterprise: 0 },
    totalRevenue: { today: 2200, month: 68000, total: 710000 },
    lastUpdated: now,
  });

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Emulator seed complete!\n');
  console.log('Test credentials:');
  console.log('  Super Admin  →  admin@utilzone.com / Admin@1234');
  console.log('  Owner        →  owner@shivajinagarpk.com / Owner@1234');
  console.log('  Attendant    →  Phone OTP (any number in emulator auth)');
  console.log('\nEmulator UI: http://localhost:4000');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
