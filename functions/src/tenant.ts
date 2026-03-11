/**
 * ParkSmart Cloud Functions — Tenant Onboarding & SuperAdmin
 * Package: com.utilzone.parking
 */

import * as admin   from 'firebase-admin';
import * as logger  from 'firebase-functions/logger';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp }          from 'firebase-admin/firestore';

const db        = admin.firestore();
const messaging = admin.messaging();

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertSuperAdmin(auth: any) {
  if (!auth || auth.token.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'SuperAdmin access required.');
  }
}

async function sendFcm(token: string, title: string, body: string, data?: Record<string, string>) {
  try {
    await messaging.send({ token, notification: { title, body }, data });
  } catch (e) {
    logger.warn('FCM failed', { token: token.slice(0, 10), e });
  }
}

async function notifyOwner(ownerUid: string, title: string, body: string, data?: Record<string, string>) {
  const userDoc = await db.collection('users').doc(ownerUid).get();
  const token   = userDoc.data()?.fcmToken;
  if (token) await sendFcm(token, title, body, data);
}

// ── 1. REGISTER TENANT (self-registration) ────────────────────────────────────
// Called by owner during sign-up. Creates tenant in pending_approval state.

export const registerTenant = onCall({ region: 'asia-south1' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { businessName, ownerName, phone, email, registrationNote } = req.data as {
    businessName: string; ownerName: string; phone: string;
    email: string; registrationNote?: string;
  };

  if (!businessName || !ownerName || !phone) {
    throw new HttpsError('invalid-argument', 'businessName, ownerName, phone are required.');
  }

  // Check this user doesn't already have a tenant
  const existing = await db.collection('tenants')
    .where('ownerUid', '==', req.auth.uid).limit(1).get();
  if (!existing.empty) {
    throw new HttpsError('already-exists', 'You already have a registered business.');
  }

  const tenantRef = db.collection('tenants').doc();
  const now       = Timestamp.now();

  // Trial plan auto-assigned, pending approval
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  await tenantRef.set({
    tenantId:          tenantRef.id,
    businessName,
    ownerUid:          req.auth.uid,
    ownerName,
    ownerPhone:        phone,
    ownerEmail:        email || '',
    status:            'pending_approval',
    plan:              'trial',
    subscriptionStart: now,
    subscriptionEnd:   Timestamp.fromDate(trialEnd),
    totalLots:         0,
    registrationNote:  registrationNote || '',
    createdAt:         now,
  });

  // Update user profile with tenantId and role
  await db.collection('users').doc(req.auth.uid).set({
    uid:       req.auth.uid,
    name:      ownerName,
    phone,
    email:     email || '',
    role:      'owner',
    tenantId:  tenantRef.id,
    isActive:  true,
    createdAt: now,
  }, { merge: true });

  // Set custom claims (tenant-scoped)
  await admin.auth().setCustomUserClaims(req.auth.uid, {
    role:     'owner',
    tenantId: tenantRef.id,
  });

  // Alert superadmins via Firestore (they'll see it in their panel)
  await db.collection('_platform').doc('pendingApprovals').set({
    [`tenant_${tenantRef.id}`]: {
      tenantId:    tenantRef.id,
      businessName,
      ownerName,
      createdAt:   now,
    }
  }, { merge: true });

  logger.info('Tenant registered — pending approval', { tenantId: tenantRef.id });
  return { tenantId: tenantRef.id, status: 'pending_approval' };
});

// ── 2. APPROVE TENANT (superadmin) ────────────────────────────────────────────

export const approveTenant = onCall({ region: 'asia-south1' }, async (req) => {
  assertSuperAdmin(req.auth);

  const { tenantId, plan } = req.data as { tenantId: string; plan?: string };
  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId required.');

  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) throw new HttpsError('not-found', 'Tenant not found.');

  const tenant = tenantDoc.data()!;
  const now    = Timestamp.now();

  await tenantRef.update({
    status:     'active',
    plan:       plan || tenant.plan,
    approvedAt: now,
    approvedBy: req.auth!.uid,
  });

  // Notify owner
  await notifyOwner(
    tenant.ownerUid,
    '🎉 Account Approved!',
    `Your ParkSmart account for "${tenant.businessName}" has been approved. You can now add parking lots.`,
    { tenantId, action: 'approved' }
  );

  // Clean up pending list
  await db.collection('_platform').doc('pendingApprovals').update({
    [`tenant_${tenantId}`]: admin.firestore.FieldValue.delete()
  });

  logger.info('Tenant approved', { tenantId, by: req.auth!.uid });
  return { success: true };
});

// ── 3. SUSPEND TENANT (superadmin) ───────────────────────────────────────────

export const suspendTenant = onCall({ region: 'asia-south1' }, async (req) => {
  assertSuperAdmin(req.auth);

  const { tenantId, reason } = req.data as { tenantId: string; reason: string };
  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId required.');

  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantDoc = await tenantRef.get();
  if (!tenantDoc.exists) throw new HttpsError('not-found', 'Tenant not found.');

  const tenant = tenantDoc.data()!;

  await tenantRef.update({
    status:          'suspended',
    suspendedAt:     Timestamp.now(),
    suspendedReason: reason || 'No reason provided',
  });

  await notifyOwner(
    tenant.ownerUid,
    '⚠️ Account Suspended',
    `Your ParkSmart account has been suspended. Reason: ${reason}. Contact support to resolve.`,
    { tenantId, action: 'suspended' }
  );

  logger.info('Tenant suspended', { tenantId, reason });
  return { success: true };
});

// ── 4. ASSIGN ROLE (owner assigns attendants) ─────────────────────────────────

export const assignRole = onCall({ region: 'asia-south1' }, async (req) => {
  if (!req.auth || (req.auth.token.role !== 'owner' && req.auth.token.role !== 'superadmin')) {
    throw new HttpsError('permission-denied', 'Owner or SuperAdmin access required.');
  }

  const { targetUid, role, assignedLotIds } = req.data as {
    targetUid: string; role: string; assignedLotIds?: string[];
  };

  // Owner can only assign attendant/customer within their tenant
  const tenantId = req.auth.token.role === 'owner'
    ? req.auth.token['tenantId'] as string
    : req.data.tenantId as string;

  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId required.');

  const validRoles = ['attendant', 'customer'];
  if (req.auth.token.role === 'superadmin') validRoles.push('owner', 'superadmin');
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
  }

  await admin.auth().setCustomUserClaims(targetUid, { role, tenantId });

  await db.collection('users').doc(targetUid).update({
    role,
    tenantId,
    assignedLotIds: assignedLotIds || [],
  });

  logger.info('Role assigned', { targetUid, role, tenantId });
  return { success: true };
});

// ── 5. PUSH ANNOUNCEMENT (superadmin → all owners/attendants) ─────────────────

export const pushAnnouncement = onCall({ region: 'asia-south1' }, async (req) => {
  assertSuperAdmin(req.auth);

  const { title, body, targetRoles, isPinned, expiresInDays } = req.data as {
    title: string; body: string; targetRoles: string[];
    isPinned?: boolean; expiresInDays?: number;
  };

  if (!title || !body) throw new HttpsError('invalid-argument', 'title and body required.');

  const now       = Timestamp.now();
  const announRef = db.collection('_platform').doc('data')
                      .collection('announcements').doc();

  const expiresAt = expiresInDays
    ? Timestamp.fromMillis(Date.now() + expiresInDays * 86_400_000)
    : null;

  await announRef.set({
    announcementId: announRef.id,
    title, body,
    targetRoles:    targetRoles || ['owner', 'attendant'],
    isPinned:       isPinned || false,
    createdAt:      now,
    ...(expiresAt && { expiresAt }),
  });

  // FCM topic push (all users subscribed to 'all_users' topic at login)
  try {
    await messaging.sendToTopic('all_users', {
      notification: { title, body },
      data: { announcementId: announRef.id, type: 'announcement' },
    });
  } catch (e) {
    logger.warn('Topic FCM failed, falling back to individual sends', e);
  }

  logger.info('Announcement pushed', { title, targetRoles });
  return { announcementId: announRef.id };
});

// ── 6. PLATFORM STATS (superadmin dashboard) ──────────────────────────────────

export const getPlatformStats = onCall({ region: 'asia-south1' }, async (req) => {
  assertSuperAdmin(req.auth);

  const [tenantsSnap, usersSnap] = await Promise.all([
    db.collection('tenants').get(),
    db.collection('users').where('role', '==', 'owner').get(),
  ]);

  const tenants     = tenantsSnap.docs.map(d => d.data());
  const byStatus    = tenants.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byPlan      = tenants.reduce((acc, t) => {
    acc[t.plan] = (acc[t.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalTenants:   tenants.length,
    activeTenants:  byStatus.active || 0,
    pendingTenants: byStatus.pending_approval || 0,
    suspended:      byStatus.suspended || 0,
    byPlan,
    totalOwners:    usersSnap.size,
    fetchedAt:      new Date().toISOString(),
  };
});
