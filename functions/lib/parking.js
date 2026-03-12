"use strict";
/**
 * ParkSmart Cloud Functions — Core Parking Operations
 * Handles both slot_based and capacity_based parking modes.
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
exports.scheduledAnomalyCheck = exports.generateReport = exports.transactionReceiptHandler = exports.endShift = exports.startShift = exports.vehicleExit = exports.vehicleEntry = void 0;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const getDb = () => admin.firestore();
const getMsg = () => admin.messaging();
// ── Shared helpers ────────────────────────────────────────────────────────────
const normalisePlate = (raw) => raw.replace(/[\s\-]/g, '').toUpperCase();
const genToken = (n) => `PKT-${String(n).padStart(4, '0')}`;
function calcFare(entryMs, exitMs, ratePerHour, rules) {
    const durationMinutes = Math.ceil((exitMs - entryMs) / 60000);
    const durationHours = durationMinutes / 60;
    const slabs = Math.ceil(durationMinutes / 30);
    const baseCharge = Math.round(slabs * 0.5 * ratePerHour);
    const penaltyCharge = durationHours > rules.overstayThresholdHours
        ? Math.round(Math.ceil(durationHours - rules.overstayThresholdHours) * rules.penaltyPerHour)
        : 0;
    return {
        durationMinutes,
        baseCharge,
        penaltyCharge,
        totalCharge: Math.min(baseCharge + penaltyCharge, rules.maxDailyCharge),
    };
}
async function sendFcm(token, title, body, data) {
    try {
        await getMsg().send({ token, notification: { title, body }, data });
    }
    catch (e) {
        logger.warn('FCM failed', e);
    }
}
async function getOwnerFcmToken(tenantId) {
    var _a, _b;
    const tenantDoc = await getDb().collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists)
        return null;
    const ownerDoc = await getDb().collection('users').doc(tenantDoc.data().ownerUid).get();
    return (_b = (_a = ownerDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken) !== null && _b !== void 0 ? _b : null;
}
async function createAnomaly(tenantId, lotId, type, severity, description, relatedId) {
    const ref = getDb().collection('tenants').doc(tenantId).collection('anomalies').doc();
    await ref.set({
        anomalyId: ref.id, tenantId, lotId, type, severity,
        description, relatedId, isResolved: false, createdAt: firestore_2.Timestamp.now(),
    });
    const fcmToken = await getOwnerFcmToken(tenantId);
    if (fcmToken) {
        await sendFcm(fcmToken, `⚠️ Alert — ${severity.toUpperCase()}`, description, { anomalyId: ref.id, type, lotId });
    }
}
// ── 1. VEHICLE ENTRY ──────────────────────────────────────────────────────────
exports.vehicleEntry = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    var _a, _b, _c, _d;
    if (!req.auth || req.auth.token['role'] !== 'attendant') {
        throw new https_1.HttpsError('permission-denied', 'Attendants only.');
    }
    const { tenantId, lotId, slotId, plateNumber, vehicleType, shiftId, customerPhone, entryImageUrl, overrideCapacity, } = req.data;
    // Validate attendant belongs to this tenant
    if (req.auth.token['tenantId'] !== tenantId) {
        throw new https_1.HttpsError('permission-denied', 'Not authorised for this tenant.');
    }
    const normPlate = normalisePlate(plateNumber);
    const tenantRef = getDb().collection('tenants').doc(tenantId);
    // Verify tenant is active
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists || tenantDoc.data().status !== 'active') {
        throw new https_1.HttpsError('failed-precondition', 'Tenant account is not active.');
    }
    // Fetch lot
    const lotRef = tenantRef.collection('parkingLots').doc(lotId);
    const lotDoc = await lotRef.get();
    if (!lotDoc.exists)
        throw new https_1.HttpsError('not-found', 'Parking lot not found.');
    const lot = lotDoc.data();
    if (!lot.isActive)
        throw new https_1.HttpsError('failed-precondition', 'This parking lot is closed.');
    // ── Duplicate plate check ──────────────────────────────────────────────────
    const dupSnap = await tenantRef.collection('sessions')
        .where('plateNumber', '==', normPlate)
        .where('status', '==', 'active')
        .where('lotId', '==', lotId)
        .limit(1).get();
    if (!dupSnap.empty) {
        throw new https_1.HttpsError('already-exists', `Vehicle ${normPlate} already parked here (Token: ${dupSnap.docs[0].data().tokenNumber}).`);
    }
    // ── Mode-specific checks ───────────────────────────────────────────────────
    let isOverflow = false;
    let slotRef = null;
    if (lot.parkingMode === 'capacity_based') {
        const current = (_a = lot.currentCount) !== null && _a !== void 0 ? _a : 0;
        const total = (_b = lot.totalCapacity) !== null && _b !== void 0 ? _b : 0;
        if (current >= total) {
            if (!lot.allowOverflow) {
                throw new https_1.HttpsError('resource-exhausted', `Parking is full (${current}/${total} vehicles). Overflow not allowed.`);
            }
            if (!overrideCapacity) {
                // Return overflow warning — client must confirm before calling again
                return {
                    requiresOverrideConfirmation: true,
                    currentCount: current,
                    capacity: total,
                    message: `Parking is full (${current}/${total}). Confirm to proceed with overflow.`,
                };
            }
            isOverflow = true;
        }
    }
    else {
        // slot_based — verify slot
        if (!slotId)
            throw new https_1.HttpsError('invalid-argument', 'slotId required for slot_based lots.');
        slotRef = tenantRef.collection('parkingLots').doc(lotId).collection('slots').doc(slotId);
        const slotDoc = await slotRef.get();
        if (!slotDoc.exists)
            throw new https_1.HttpsError('not-found', 'Slot not found.');
        if (slotDoc.data().status !== 'free') {
            throw new https_1.HttpsError('failed-precondition', `Slot ${slotId} is not free.`);
        }
    }
    // ── Atomic write ──────────────────────────────────────────────────────────
    const counterRef = getDb().collection('_counters').doc(`${tenantId}_${lotId}`);
    const sessionRef = tenantRef.collection('sessions').doc();
    let tokenNumber = '';
    const now = firestore_2.Timestamp.now();
    await getDb().runTransaction(async (txn) => {
        const counterDoc = await txn.get(counterRef);
        const counter = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
        tokenNumber = genToken(counter);
        const qrPayload = `PSK:${sessionRef.id}:${tenantId}:${lotId}:${Date.now().toString(36)}`;
        txn.set(sessionRef, {
            sessionId: sessionRef.id,
            tokenNumber,
            tenantId,
            lotId,
            parkingMode: lot.parkingMode,
            slotId: slotId || null,
            plateNumber: normPlate,
            vehicleType,
            attendantId: req.auth.uid,
            shiftId,
            customerId: null,
            customerPhone: customerPhone || null,
            entryTime: now,
            exitTime: null,
            durationMinutes: null,
            chargeAmount: null,
            paymentMethod: null,
            paymentStatus: 'pending',
            qrCodeData: qrPayload,
            entryImageUrl: entryImageUrl || null,
            status: 'active',
            isOverflow,
        });
        // Capacity-based: increment count
        if (lot.parkingMode === 'capacity_based') {
            txn.update(lotRef, { currentCount: firestore_2.FieldValue.increment(1) });
        }
        else if (slotRef) {
            // Slot-based: mark slot occupied
            txn.update(slotRef, {
                status: 'occupied', currentSessionId: sessionRef.id,
                vehicleType, lastUpdated: now,
            });
        }
        txn.set(counterRef, { count: counter }, { merge: true });
    });
    logger.info('Vehicle entry', { tenantId, sessionId: sessionRef.id, tokenNumber, normPlate });
    // FCM to customer
    if (customerPhone) {
        const userSnap = await getDb().collection('users')
            .where('phone', '==', customerPhone).limit(1).get();
        if (!userSnap.empty) {
            const fcmToken = userSnap.docs[0].data().fcmToken;
            if (fcmToken) {
                await sendFcm(fcmToken, '🎫 Parking Token Issued', `Token ${tokenNumber}${slotId ? ` — Slot ${slotId}` : ''}. Entry logged at ${lot.name}.`, { sessionId: sessionRef.id, tokenNumber });
            }
        }
    }
    // Overflow anomaly flag
    if (isOverflow) {
        await createAnomaly(tenantId, lotId, 'overflow_exceeded', 'medium', `Overflow entry at ${lot.name}. Token ${tokenNumber}, vehicle ${normPlate}.`, sessionRef.id);
    }
    return {
        sessionId: sessionRef.id,
        tokenNumber,
        qrCodeData: `PSK:${sessionRef.id}:${tenantId}:${lotId}`,
        slotId: slotId || null,
        entryTime: now.toDate().toISOString(),
        estimatedRate: (_c = lot.rateCard[vehicleType]) !== null && _c !== void 0 ? _c : 30,
        isOverflow,
        currentCount: lot.parkingMode === 'capacity_based' ? ((_d = lot.currentCount) !== null && _d !== void 0 ? _d : 0) + 1 : undefined,
        capacity: lot.parkingMode === 'capacity_based' ? lot.totalCapacity : undefined,
    };
});
// ── 2. VEHICLE EXIT ───────────────────────────────────────────────────────────
exports.vehicleExit = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    var _a;
    if (!req.auth || req.auth.token['role'] !== 'attendant') {
        throw new https_1.HttpsError('permission-denied', 'Attendants only.');
    }
    const { tenantId, sessionId, paymentMethod, upiRef, cashPhotoUrl } = req.data;
    if (req.auth.token['tenantId'] !== tenantId) {
        throw new https_1.HttpsError('permission-denied', 'Not authorised for this tenant.');
    }
    if (paymentMethod === 'Cash' && !cashPhotoUrl) {
        throw new https_1.HttpsError('invalid-argument', 'Cash payments require a photo proof URL.');
    }
    const tenantRef = getDb().collection('tenants').doc(tenantId);
    const sessionRef = tenantRef.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists)
        throw new https_1.HttpsError('not-found', 'Session not found.');
    const session = sessionDoc.data();
    if (session.status !== 'active')
        throw new https_1.HttpsError('failed-precondition', 'Session is not active.');
    const lotRef = tenantRef.collection('parkingLots').doc(session.lotId);
    const lotDoc = await lotRef.get();
    const lot = lotDoc.data();
    const ratePerHour = (_a = lot.rateCard[session.vehicleType]) !== null && _a !== void 0 ? _a : 30;
    const exitMs = Date.now();
    const entryMs = session.entryTime.toMillis();
    const fare = calcFare(entryMs, exitMs, ratePerHour, lot.penaltyRules);
    const txnRef = tenantRef.collection('transactions').doc();
    const shiftRef = tenantRef.collection('shifts').doc(session.shiftId);
    const now = firestore_2.Timestamp.now();
    let slotRef = null;
    if (session.parkingMode === 'slot_based' && session.slotId) {
        slotRef = tenantRef.collection('parkingLots').doc(session.lotId)
            .collection('slots').doc(session.slotId);
    }
    await getDb().runTransaction(async (txn) => {
        // Finalise session
        txn.update(sessionRef, {
            exitTime: now, durationMinutes: fare.durationMinutes,
            chargeAmount: fare.totalCharge, paymentMethod,
            paymentStatus: 'paid', status: 'completed',
        });
        // Create immutable transaction
        txn.set(txnRef, {
            txnId: txnRef.id, tenantId, sessionId,
            lotId: session.lotId, attendantId: req.auth.uid,
            customerId: session.customerId || null,
            amount: fare.totalCharge, method: paymentMethod,
            upiRef: upiRef || null, cashPhotoUrl: cashPhotoUrl || null,
            timestamp: now, receiptSent: false,
        });
        // Free slot (slot_based)
        if (slotRef) {
            txn.update(slotRef, {
                status: 'free', currentSessionId: null,
                vehicleType: null, lastUpdated: now,
            });
        }
        // Decrement capacity (capacity_based)
        if (session.parkingMode === 'capacity_based') {
            txn.update(lotRef, { currentCount: firestore_2.FieldValue.increment(-1) });
        }
        // Update shift totals
        const isDigital = paymentMethod !== 'Cash';
        txn.update(shiftRef, {
            totalRevenue: firestore_2.FieldValue.increment(fare.totalCharge),
            totalCash: firestore_2.FieldValue.increment(isDigital ? 0 : fare.totalCharge),
            totalDigital: firestore_2.FieldValue.increment(isDigital ? fare.totalCharge : 0),
            vehicleCount: firestore_2.FieldValue.increment(1),
        });
    });
    logger.info('Vehicle exit', { tenantId, sessionId, txnId: txnRef.id, charge: fare.totalCharge });
    return {
        txnId: txnRef.id,
        durationMinutes: fare.durationMinutes,
        baseCharge: fare.baseCharge,
        penaltyCharge: fare.penaltyCharge,
        totalCharge: fare.totalCharge,
    };
});
// ── 3. START SHIFT ────────────────────────────────────────────────────────────
exports.startShift = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    var _a;
    if (!req.auth || req.auth.token['role'] !== 'attendant') {
        throw new https_1.HttpsError('permission-denied', 'Attendants only.');
    }
    const { tenantId, lotId } = req.data;
    if (req.auth.token['tenantId'] !== tenantId) {
        throw new https_1.HttpsError('permission-denied', 'Not authorised for this tenant.');
    }
    // Attendant must be assigned to this lot
    const userDoc = await getDb().collection('users').doc(req.auth.uid).get();
    const assignedLotIds = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.assignedLotIds) || [];
    if (!assignedLotIds.includes(lotId)) {
        throw new https_1.HttpsError('permission-denied', 'You are not assigned to this lot.');
    }
    // No duplicate active shift
    const existing = await getDb().collection('tenants').doc(tenantId).collection('shifts')
        .where('attendantId', '==', req.auth.uid)
        .where('status', '==', 'active').limit(1).get();
    if (!existing.empty) {
        throw new https_1.HttpsError('already-exists', 'You already have an active shift. End it first.');
    }
    const shiftRef = getDb().collection('tenants').doc(tenantId).collection('shifts').doc();
    const userData = userDoc.data();
    await shiftRef.set({
        shiftId: shiftRef.id,
        tenantId,
        attendantId: req.auth.uid,
        attendantName: userData.name || 'Unknown',
        lotId,
        startTime: firestore_2.Timestamp.now(),
        endTime: null,
        totalCash: 0,
        totalDigital: 0,
        totalRevenue: 0,
        expectedRevenue: 0,
        discrepancy: 0,
        vehicleCount: 0,
        status: 'active',
    });
    return { shiftId: shiftRef.id };
});
// ── 4. END SHIFT + RECONCILIATION ────────────────────────────────────────────
exports.endShift = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    var _a;
    if (!req.auth || req.auth.token['role'] !== 'attendant') {
        throw new https_1.HttpsError('permission-denied', 'Attendants only.');
    }
    const { tenantId, shiftId } = req.data;
    const shiftRef = getDb().collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
    const shiftDoc = await shiftRef.get();
    if (!shiftDoc.exists)
        throw new https_1.HttpsError('not-found', 'Shift not found.');
    const shift = shiftDoc.data();
    if (shift.attendantId !== req.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'You can only end your own shift.');
    }
    // Sum expected revenue from completed sessions in this shift
    const sessionsSnap = await getDb().collection('tenants').doc(tenantId).collection('sessions')
        .where('shiftId', '==', shiftId)
        .where('status', '==', 'completed').get();
    const expectedRevenue = sessionsSnap.docs.reduce((sum, d) => { var _a; return sum + ((_a = d.data().chargeAmount) !== null && _a !== void 0 ? _a : 0); }, 0);
    const actualRevenue = (_a = shift.totalRevenue) !== null && _a !== void 0 ? _a : 0;
    const discrepancy = Math.round(expectedRevenue - actualRevenue);
    const isFlagged = Math.abs(discrepancy) > 100;
    await shiftRef.update({
        endTime: firestore_2.Timestamp.now(),
        expectedRevenue, discrepancy,
        status: isFlagged ? 'flagged' : 'closed',
    });
    if (isFlagged) {
        await createAnomaly(tenantId, shift.lotId, 'shift_discrepancy', 'high', `${shift.attendantName} shift discrepancy ₹${discrepancy}. Expected ₹${expectedRevenue}, collected ₹${actualRevenue}.`, shiftId);
    }
    return { shiftId, totalRevenue: actualRevenue, expectedRevenue, discrepancy, status: isFlagged ? 'flagged' : 'closed' };
});
// ── 5. TRANSACTION CREATED → receipt FCM + revenue counter ───────────────────
exports.transactionReceiptHandler = (0, firestore_1.onDocumentCreated)({ document: 'tenants/{tenantId}/transactions/{txnId}', region: 'asia-south1' }, async (event) => {
    var _a, _b;
    const txn = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!txn)
        return;
    const { tenantId } = event.params;
    // Send receipt to customer
    if (txn.customerId) {
        const userDoc = await getDb().collection('users').doc(txn.customerId).get();
        const fcmToken = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken;
        if (fcmToken) {
            await getMsg().send({
                token: fcmToken,
                notification: { title: '✅ Parking Receipt', body: `₹${txn.amount} paid via ${txn.method}.` },
                data: { txnId: txn.txnId, amount: String(txn.amount) },
            });
            await event.data.ref.update({ receiptSent: true });
        }
    }
    // Revenue aggregation on lot doc
    await getDb().collection('tenants').doc(tenantId)
        .collection('parkingLots').doc(txn.lotId)
        .update({
        'revenue.today': firestore_2.FieldValue.increment(txn.amount),
        'revenue.total': firestore_2.FieldValue.increment(txn.amount),
    });
    // Platform-level revenue aggregation (superadmin visibility)
    await getDb().collection('_platform').doc('stats').set({
        totalRevenueAllTime: firestore_2.FieldValue.increment(txn.amount),
        txnCount: firestore_2.FieldValue.increment(1),
    }, { merge: true });
});
// ── 6. GENERATE REPORT ────────────────────────────────────────────────────────
exports.generateReport = (0, https_1.onCall)({ region: 'asia-south1' }, async (req) => {
    if (!req.auth || req.auth.token['role'] !== 'owner') {
        throw new https_1.HttpsError('permission-denied', 'Owners only.');
    }
    const { tenantId, lotId, fromDate, toDate } = req.data;
    if (req.auth.token['tenantId'] !== tenantId) {
        throw new https_1.HttpsError('permission-denied', 'Not authorised for this tenant.');
    }
    const from = admin.firestore.Timestamp.fromDate(new Date(fromDate));
    const to = admin.firestore.Timestamp.fromDate(new Date(toDate));
    let query = getDb().collection('tenants').doc(tenantId).collection('transactions')
        .where('timestamp', '>=', from).where('timestamp', '<=', to);
    if (lotId)
        query = query.where('lotId', '==', lotId);
    const txnSnap = await query.orderBy('timestamp', 'desc').get();
    const txns = txnSnap.docs.map(d => d.data());
    const totalRevenue = txns.reduce((s, t) => s + t.amount, 0);
    const byCash = txns.filter(t => t.method === 'Cash').reduce((s, t) => s + t.amount, 0);
    const byMethod = txns.reduce((acc, t) => {
        acc[t.method] = (acc[t.method] || 0) + t.amount;
        return acc;
    }, {});
    const reportRef = getDb().collection('tenants').doc(tenantId).collection('reports').doc();
    const report = {
        reportId: reportRef.id, tenantId, lotId: lotId || 'all',
        fromDate, toDate, totalTransactions: txns.length,
        totalRevenue, cashRevenue: byCash, digitalRevenue: totalRevenue - byCash,
        byMethod, generatedAt: new Date().toISOString(),
    };
    await reportRef.set(report);
    return report;
});
// ── 7. SCHEDULED ANOMALY CHECK (daily 1AM IST) ────────────────────────────────
exports.scheduledAnomalyCheck = (0, scheduler_1.onSchedule)({ schedule: '0 1 * * *', timeZone: 'Asia/Kolkata', region: 'asia-south1' }, async () => {
    logger.info('Running daily anomaly check…');
    const threshold = firestore_2.Timestamp.fromMillis(Date.now() - 8 * 3600000);
    // Find all active sessions older than 8 hours across ALL tenants
    const tenantsSnap = await getDb().collection('tenants')
        .where('status', '==', 'active').get();
    for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;
        const longStay = await getDb().collection('tenants').doc(tenantId)
            .collection('sessions')
            .where('status', '==', 'active')
            .where('entryTime', '<', threshold).get();
        for (const s of longStay.docs) {
            const d = s.data();
            const hrs = Math.round((Date.now() - d.entryTime.toMillis()) / 3600000);
            await createAnomaly(tenantId, d.lotId, 'long_stay_no_payment', 'medium', `Vehicle ${d.plateNumber} (${d.tokenNumber}) parked ${hrs}h with no exit.`, s.id);
        }
        // Reset daily revenue counters on all lots
        const lots = await getDb().collection('tenants').doc(tenantId).collection('parkingLots').get();
        const batch = getDb().batch();
        lots.forEach(l => batch.update(l.ref, { 'revenue.today': 0 }));
        await batch.commit();
    }
    logger.info('Anomaly check complete.');
});
//# sourceMappingURL=parking.js.map