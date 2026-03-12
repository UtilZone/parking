"use strict";
/**
 * ParkSmart Cloud Functions — Tenant Onboarding & SuperAdmin
 * Package: com.utilzone.parking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAttendant = exports.getPlatformStats = exports.pushAnnouncement = exports.assignRole = exports.suspendTenant = exports.approveTenant = exports.registerTenant = void 0;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const getDb = () => admin.firestore();
const getMsg = () => admin.messaging();
// ── Helpers ───────────────────────────────────────────────────────────────────
function assertSuperAdmin(auth) {
    if (!auth || auth.token.role !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'SuperAdmin access required.');
    }
}
async function sendFcm(token, title, body, data) {
    try {
        await getMsg().send({ token, notification: { title, body }, data });
    }
    catch (e) {
        logger.warn('FCM failed', { token: token.slice(0, 10), e });
    }
}
async function notifyOwner(ownerUid, title, body, data) {
    var _a;
    const userDoc = await getDb().collection('users').doc(ownerUid).get();
    const token = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
    if (token)
        await sendFcm(token, title, body, data);
}
// ── 1. REGISTER TENANT (self-registration) ────────────────────────────────────
// Called by owner during sign-up. Creates tenant in pending_approval state.
exports.registerTenant = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    const { businessName, ownerName, phone, email, registrationNote } = req.data;
    if (!businessName || !ownerName || !phone) {
        throw new https_1.HttpsError('invalid-argument', 'businessName, ownerName, phone are required.');
    }
    // Check this user doesn't already have a tenant
    const existing = await getDb().collection('tenants')
        .where('ownerUid', '==', req.auth.uid).limit(1).get();
    if (!existing.empty) {
        throw new https_1.HttpsError('already-exists', 'You already have a registered business.');
    }
    const tenantRef = getDb().collection('tenants').doc();
    const now = firestore_1.Timestamp.now();
    // Trial plan auto-assigned, pending approval
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await tenantRef.set({
        tenantId: tenantRef.id,
        businessName,
        ownerUid: req.auth.uid,
        ownerName,
        ownerPhone: phone,
        ownerEmail: email || '',
        status: 'pending_approval',
        plan: 'trial',
        subscriptionStart: now,
        subscriptionEnd: firestore_1.Timestamp.fromDate(trialEnd),
        totalLots: 0,
        registrationNote: registrationNote || '',
        createdAt: now,
    });
    // Update user profile with tenantId and role
    await getDb().collection('users').doc(req.auth.uid).set({
        uid: req.auth.uid,
        name: ownerName,
        phone,
        email: email || '',
        role: 'owner',
        tenantId: tenantRef.id,
        isActive: true,
        createdAt: now,
    }, { merge: true });
    // Set custom claims (tenant-scoped)
    await admin.auth().setCustomUserClaims(req.auth.uid, {
        role: 'owner',
        tenantId: tenantRef.id,
    });
    // Alert superadmins via Firestore (they'll see it in their panel)
    await getDb().collection('_platform').doc('pendingApprovals').set({
        [`tenant_${tenantRef.id}`]: {
            tenantId: tenantRef.id,
            businessName,
            ownerName,
            createdAt: now,
        }
    }, { merge: true });
    logger.info('Tenant registered — pending approval', { tenantId: tenantRef.id });
    return { tenantId: tenantRef.id, status: 'pending_approval' };
});
// ── 2. APPROVE TENANT (superadmin) ────────────────────────────────────────────
exports.approveTenant = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    assertSuperAdmin(req.auth);
    const { tenantId, plan } = req.data;
    if (!tenantId)
        throw new https_1.HttpsError('invalid-argument', 'tenantId required.');
    const tenantRef = getDb().collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists)
        throw new https_1.HttpsError('not-found', 'Tenant not found.');
    const tenant = tenantDoc.data();
    const now = firestore_1.Timestamp.now();
    await tenantRef.update({
        status: 'active',
        plan: plan || tenant.plan,
        approvedAt: now,
        approvedBy: req.auth.uid,
    });
    // Notify owner
    await notifyOwner(tenant.ownerUid, '🎉 Account Approved!', `Your ParkSmart account for "${tenant.businessName}" has been approved. You can now add parking lots.`, { tenantId, action: 'approved' });
    // Clean up pending list
    await getDb().collection('_platform').doc('pendingApprovals').update({
        [`tenant_${tenantId}`]: admin.firestore.FieldValue.delete()
    });
    logger.info('Tenant approved', { tenantId, by: req.auth.uid });
    return { success: true };
});
// ── 3. SUSPEND TENANT (superadmin) ───────────────────────────────────────────
exports.suspendTenant = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    assertSuperAdmin(req.auth);
    const { tenantId, reason } = req.data;
    if (!tenantId)
        throw new https_1.HttpsError('invalid-argument', 'tenantId required.');
    const tenantRef = getDb().collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists)
        throw new https_1.HttpsError('not-found', 'Tenant not found.');
    const tenant = tenantDoc.data();
    await tenantRef.update({
        status: 'suspended',
        suspendedAt: firestore_1.Timestamp.now(),
        suspendedReason: reason || 'No reason provided',
    });
    await notifyOwner(tenant.ownerUid, '⚠️ Account Suspended', `Your ParkSmart account has been suspended. Reason: ${reason}. Contact support to resolve.`, { tenantId, action: 'suspended' });
    logger.info('Tenant suspended', { tenantId, reason });
    return { success: true };
});
// ── 4. ASSIGN ROLE (owner assigns attendants) ─────────────────────────────────
exports.assignRole = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    if (!req.auth || (req.auth.token.role !== 'owner' && req.auth.token.role !== 'superadmin')) {
        throw new https_1.HttpsError('permission-denied', 'Owner or SuperAdmin access required.');
    }
    const { targetUid, role, assignedLotIds } = req.data;
    // Owner can only assign attendant/customer within their tenant
    const tenantId = req.auth.token.role === 'owner'
        ? req.auth.token['tenantId']
        : req.data.tenantId;
    if (!tenantId)
        throw new https_1.HttpsError('invalid-argument', 'tenantId required.');
    const validRoles = ['attendant', 'customer'];
    if (req.auth.token.role === 'superadmin')
        validRoles.push('owner', 'superadmin');
    if (!validRoles.includes(role)) {
        throw new https_1.HttpsError('invalid-argument', `Invalid role: ${role}`);
    }
    await admin.auth().setCustomUserClaims(targetUid, { role, tenantId });
    await getDb().collection('users').doc(targetUid).update({
        role,
        tenantId,
        assignedLotIds: assignedLotIds || [],
    });
    logger.info('Role assigned', { targetUid, role, tenantId });
    return { success: true };
});
// ── 5. PUSH ANNOUNCEMENT (superadmin → all owners/attendants) ─────────────────
exports.pushAnnouncement = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    assertSuperAdmin(req.auth);
    const { title, body, targetRoles, isPinned, expiresInDays } = req.data;
    if (!title || !body)
        throw new https_1.HttpsError('invalid-argument', 'title and body required.');
    const now = firestore_1.Timestamp.now();
    const announRef = getDb().collection('_platform').doc('data')
        .collection('announcements').doc();
    const expiresAt = expiresInDays
        ? firestore_1.Timestamp.fromMillis(Date.now() + expiresInDays * 86400000)
        : null;
    await announRef.set(Object.assign({ announcementId: announRef.id, title, body, targetRoles: targetRoles || ['owner', 'attendant'], isPinned: isPinned || false, createdAt: now }, (expiresAt && { expiresAt })));
    // FCM topic push (all users subscribed to 'all_users' topic at login)
    try {
        await getMsg().sendToTopic('all_users', {
            notification: { title, body },
            data: { announcementId: announRef.id, type: 'announcement' },
        });
    }
    catch (e) {
        logger.warn('Topic FCM failed, falling back to individual sends', e);
    }
    logger.info('Announcement pushed', { title, targetRoles });
    return { announcementId: announRef.id };
});
// ── 6. PLATFORM STATS (superadmin dashboard) ──────────────────────────────────
exports.getPlatformStats = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    assertSuperAdmin(req.auth);
    const [tenantsSnap, usersSnap] = await Promise.all([
        getDb().collection('tenants').get(),
        getDb().collection('users').where('role', '==', 'owner').get(),
    ]);
    const tenants = tenantsSnap.docs.map(d => d.data());
    const byStatus = tenants.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
    }, {});
    const byPlan = tenants.reduce((acc, t) => {
        acc[t.plan] = (acc[t.plan] || 0) + 1;
        return acc;
    }, {});
    return {
        totalTenants: tenants.length,
        activeTenants: byStatus.active || 0,
        pendingTenants: byStatus.pending_approval || 0,
        suspended: byStatus.suspended || 0,
        byPlan,
        totalOwners: usersSnap.size,
        fetchedAt: new Date().toISOString(),
    };
});
// ── CREATE ATTENDANT (owner creates auth account + assigns role) ──────────────
exports.createAttendant = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    if (!req.auth || req.auth.token.role !== 'owner') {
        throw new https_1.HttpsError('permission-denied', 'Owner access required.');
    }
    const { name, email, password, phone, assignedLotIds } = req.data;
    if (!name || !email || !password) {
        throw new https_1.HttpsError('invalid-argument', 'name, email, and password are required.');
    }
    if (password.length < 8) {
        throw new https_1.HttpsError('invalid-argument', 'Password must be at least 8 characters.');
    }
    const tenantId = req.auth.token['tenantId'];
    if (!tenantId)
        throw new https_1.HttpsError('failed-precondition', 'No tenantId on owner token.');
    // Create Firebase Auth account
    let userRecord;
    try {
        userRecord = await admin.auth().createUser({
            email, password,
            displayName: name,
        });
    }
    catch (e) {
        if (e.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'An account with this email already exists.');
        }
        throw new https_1.HttpsError('internal', e.message);
    }
    const now = firestore_1.Timestamp.now();
    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: 'attendant',
        tenantId,
    });
    // Create Firestore user document
    await getDb().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name,
        email,
        phone: phone || '',
        role: 'attendant',
        tenantId,
        assignedLotIds: assignedLotIds || [],
        isActive: true,
        createdAt: now,
    });
    logger.info('Attendant created', { uid: userRecord.uid, tenantId });
    return { uid: userRecord.uid, success: true };
});
//# sourceMappingURL=tenant.js.map