#!/usr/bin/env node
/**
 * scripts/create-superadmin.js
 *
 * Run this ONCE after first Firebase deploy to set the superadmin custom claim.
 * The user must already exist in Firebase Authentication.
 *
 * Prerequisites:
 *   1. firebase login  (already done)
 *   2. npm install firebase-admin  (run inside functions/ folder)
 *   3. Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *      (Download from Firebase Console → Project Settings → Service accounts → Generate key)
 *
 * Usage:
 *   node scripts/create-superadmin.js <email> <uid>
 *
 * Example:
 *   node scripts/create-superadmin.js admin@utilzone.com abc123xyz
 */

const admin = require('firebase-admin');

const [,, email, uid] = process.argv;

if (!email || !uid) {
  console.error('Usage: node scripts/create-superadmin.js <email> <uid>');
  console.error('');
  console.error('Find the UID in Firebase Console → Authentication → Users');
  process.exit(1);
}

// Initialize with application default credentials
// Requires GOOGLE_APPLICATION_CREDENTIALS env var
try {
  admin.initializeApp();
} catch (e) {
  // Already initialized
}

async function run() {
  console.log(`\n⬡ ParkSmart — Super Admin Setup`);
  console.log(`Setting superadmin claim for: ${email} (${uid})\n`);

  try {
    // Verify user exists
    const user = await admin.auth().getUser(uid);
    if (user.email !== email) {
      console.error(`❌ Email mismatch. UID ${uid} belongs to ${user.email}, not ${email}.`);
      process.exit(1);
    }

    // Set custom claim
    await admin.auth().setCustomUserClaims(uid, { role: 'superadmin' });

    // Create/update Firestore user document
    await admin.firestore().doc(`users/${uid}`).set({
      uid,
      email,
      name:      'Super Admin',
      phone:     '',
      role:      'superadmin',
      isActive:  true,
      createdAt: admin.firestore.Timestamp.now(),
    }, { merge: true });

    console.log(`✅ Success! ${email} is now a Super Admin.`);
    console.log(`\nThe user must sign out and sign back in for the claim to take effect.`);
    console.log(`Login URL: your-superadmin-panel.web.app\n`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

run();
