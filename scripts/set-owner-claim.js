#!/usr/bin/env node
/**
 * scripts/set-owner-claim.js
 *
 * Manually set owner custom claims for a user who registered outside
 * the normal flow, or whose claims are missing.
 *
 * Usage:
 *   node scripts/set-owner-claim.js <email> <uid> <tenantId>
 *
 * Find tenantId in Firebase Console → Firestore → tenants collection
 */

const admin = require('firebase-admin');

const [,, email, uid, tenantId] = process.argv;

if (!email || !uid || !tenantId) {
  console.error('Usage: node scripts/set-owner-claim.js <email> <uid> <tenantId>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/set-owner-claim.js owner@biz.com abc123 tenant456');
  console.error('');
  console.error('Find tenantId in Firebase Console → Firestore → tenants collection (document ID)');
  process.exit(1);
}

try { admin.initializeApp(); } catch(e) {}

async function run() {
  console.log('\n⬡ ParkSmart — Set Owner Claim');
  console.log(`Email:    ${email}`);
  console.log(`UID:      ${uid}`);
  console.log(`TenantId: ${tenantId}\n`);

  try {
    // Verify user exists
    const user = await admin.auth().getUser(uid);
    if (user.email !== email) {
      console.error(`❌ Email mismatch. UID ${uid} belongs to ${user.email}`);
      process.exit(1);
    }

    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, {
      role:     'owner',
      tenantId: tenantId,
    });

    // Update Firestore user doc
    await admin.firestore().doc(`users/${uid}`).set({
      uid, email,
      role:     'owner',
      tenantId: tenantId,
      isActive: true,
    }, { merge: true });

    // Update tenant ownerUid
    await admin.firestore().doc(`tenants/${tenantId}`).set({
      ownerUid: uid,
    }, { merge: true });

    console.log('✅ Owner claim set successfully!');
    console.log('\nIMPORTANT: The user must sign out and sign back in for changes to take effect.\n');
  } catch(err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
