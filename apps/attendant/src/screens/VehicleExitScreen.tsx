/**
 * VehicleExitScreen — Attendant App
 * QR scan → session lookup → fare display → payment collection
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { httpsCallable }    from 'firebase/functions';
import { doc, getDoc }      from 'firebase/firestore';
import * as ImagePicker     from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, firestore, storage }    from '../config/firebase';
import { useAuth }                          from '../hooks/useAuth';

type PaymentMethod = 'UPI' | 'Cash' | 'Card' | 'Wallet';

interface ActiveLot {
  lotId: string; name: string; parkingMode: string;
}

interface SessionData {
  sessionId:    string;
  tokenNumber:  string;
  plateNumber:  string;
  vehicleType:  string;
  slotId?:      string;
  parkingMode:  string;
  entryTime:    any;
  status:       string;
  lotId:        string;
}

interface ExitResult {
  txnId: string; durationMinutes: number;
  baseCharge: number; penaltyCharge: number; totalCharge: number;
}

const PAY_METHODS: { value: PaymentMethod; icon: string; label: string; color: string }[] = [
  { value: 'UPI',    icon: '📱', label: 'UPI',    color: '#10B981' },
  { value: 'Cash',   icon: '💵', label: 'Cash',   color: '#F59E0B' },
  { value: 'Card',   icon: '💳', label: 'Card',   color: '#3B82F6' },
  { value: 'Wallet', icon: '👛', label: 'Wallet', color: '#A78BFA' },
];

interface Props { shiftId: string; activeLot: ActiveLot; }

export default function VehicleExitScreen({ activeLot }: Props) {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,      setScanning]      = useState(false);
  const [session,       setSession]       = useState<SessionData | null>(null);
  const [payMethod,     setPayMethod]     = useState<PaymentMethod>('UPI');
  const [upiRef,        setUpiRef]        = useState('');
  const [cashPhotoUri,  setCashPhotoUri]  = useState<string | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [exitResult,    setExitResult]    = useState<ExitResult | null>(null);
  const [manualToken,   setManualToken]   = useState('');
  const hasScanned = useRef(false);

  // ── QR scan ────────────────────────────────────────────────────────────────
  const onBarCodeScanned = async ({ data }: { data: string }) => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    setScanning(false);
    await loadSession(data);
  };

  const loadSession = async (qrOrToken: string) => {
    if (!user?.tenantId) return;
    try {
      // Parse "PSK:{sessionId}:{tenantId}:{lotId}:..." or raw sessionId
      let sessionId = qrOrToken;
      if (qrOrToken.startsWith('PSK:')) {
        const parts = qrOrToken.split(':');
        sessionId   = parts[1];
      }

      const sessionDoc = await getDoc(
        doc(firestore, 'tenants', user.tenantId, 'sessions', sessionId)
      );
      if (!sessionDoc.exists()) {
        Alert.alert('Not Found', 'Session not found. Please check the token manually.');
        hasScanned.current = false;
        return;
      }
      const data = { ...sessionDoc.data(), sessionId } as SessionData;

      if (data.status === 'completed') {
        Alert.alert('Already Exited', `Token ${data.tokenNumber} has already been processed.`);
        hasScanned.current = false;
        return;
      }
      if (data.lotId !== activeLot.lotId) {
        Alert.alert('Wrong Lot', `This token belongs to a different parking lot.`);
        hasScanned.current = false;
        return;
      }
      setSession(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
      hasScanned.current = false;
    }
  };

  // ── Manual token lookup ────────────────────────────────────────────────────
  const handleManualLookup = async () => {
    if (!manualToken.trim() || !user?.tenantId) return;
    // Search sessions by tokenNumber
    const { getDocs, query, collection, where } = await import('firebase/firestore');
    const q = query(
      collection(firestore, 'tenants', user.tenantId, 'sessions'),
      where('tokenNumber', '==', manualToken.trim().toUpperCase()),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      Alert.alert('Not Found', `No active session for token ${manualToken}.`);
      return;
    }
    const d = snap.docs[0];
    setSession({ ...d.data(), sessionId: d.id } as SessionData);
    setManualToken('');
  };

  // ── Cash photo ─────────────────────────────────────────────────────────────
  const pickCashPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setCashPhotoUri(result.assets[0].uri);
  };

  // ── Submit exit ────────────────────────────────────────────────────────────
  const handleExit = async () => {
    if (!session || !user) return;
    if (payMethod === 'Cash' && !cashPhotoUri) {
      Alert.alert('Cash Photo Required', 'Please photograph the cash before confirming.');
      return;
    }

    setIsSubmitting(true);
    try {
      let cashPhotoUrl: string | undefined;
      if (payMethod === 'Cash' && cashPhotoUri) {
        const resp    = await fetch(cashPhotoUri);
        const blob    = await resp.blob();
        const fileRef = ref(storage,
          `tenants/${user.tenantId}/cash-proofs/temp_${session.sessionId}.jpg`);
        await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
        cashPhotoUrl = await getDownloadURL(fileRef);
      }

      const fn = httpsCallable<object, ExitResult>(functions, 'vehicleExit');
      const result = await fn({
        tenantId:      user.tenantId,
        sessionId:     session.sessionId,
        paymentMethod: payMethod,
        upiRef:        upiRef.trim() || undefined,
        cashPhotoUrl,
      });
      setExitResult(result.data);
    } catch (err: any) {
      Alert.alert('Exit Failed', err.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setSession(null); setExitResult(null);
    setPayMethod('UPI'); setUpiRef('');
    setCashPhotoUri(null);
    hasScanned.current = false;
  };

  // ── Duration helper ────────────────────────────────────────────────────────
  const fmtDur = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // ── Success ────────────────────────────────────────────────────────────────
  if (exitResult) {
    return (
      <View style={styles.successShell}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Exit Processed</Text>
        <View style={styles.receiptCard}>
          {[
            ['Duration',   fmtDur(exitResult.durationMinutes)],
            ['Base Charge',`₹${exitResult.baseCharge}`],
            ['Penalty',    exitResult.penaltyCharge > 0 ? `₹${exitResult.penaltyCharge}` : 'None'],
            ['Total Paid', `₹${exitResult.totalCharge}`],
            ['Method',     payMethod],
            ['Txn ID',     exitResult.txnId.slice(0, 12) + '…'],
          ].map(([k, v]) => (
            <View style={styles.receiptRow} key={k}>
              <Text style={styles.receiptKey}>{k}</Text>
              <Text style={[styles.receiptVal,
                k === 'Total Paid' && { color: '#10B981', fontSize: 20 }
              ]}>{v}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={reset}>
          <Text style={styles.doneBtnText}>Done — Next Vehicle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── QR Scanner overlay ─────────────────────────────────────────────────────
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={onBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.scanOverlay}>
          <Text style={styles.scanTitle}>Scan Exit QR Code</Text>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Align the QR within the frame</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main exit form ─────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.lotBadge}>
        <Text style={styles.lotBadgeName}>{activeLot.name}</Text>
        <Text style={styles.lotBadgeSub}>Exit Processing</Text>
      </View>

      {!session ? (
        <>
          {/* Scan QR */}
          <TouchableOpacity
            style={styles.scanQrBtn}
            onPress={async () => { if (!permission?.granted) await requestPermission(); hasScanned.current = false; setScanning(true); }}
          >
            <Text style={styles.scanQrIcon}>📷</Text>
            <Text style={styles.scanQrTitle}>Scan QR Token</Text>
            <Text style={styles.scanQrSub}>Point camera at customer's exit QR</Text>
          </TouchableOpacity>

          <Text style={styles.orDivider}>— OR —</Text>

          {/* Manual token entry */}
          <Text style={styles.label}>ENTER TOKEN MANUALLY</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              value={manualToken}
              onChangeText={v => setManualToken(v.toUpperCase())}
              placeholder="PKT-0042"
              placeholderTextColor="#3A506B"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.lookupBtn} onPress={handleManualLookup}>
              <Text style={styles.lookupBtnText}>Look up</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          {/* Session info */}
          <View style={styles.sessionCard}>
            <View style={styles.sessionTopRow}>
              <Text style={styles.tokenDisplay}>{session.tokenNumber}</Text>
              <TouchableOpacity onPress={() => { setSession(null); hasScanned.current = false; }}>
                <Text style={styles.clearBtn}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            {[
              ['Plate',  session.plateNumber],
              ['Type',   session.vehicleType?.toUpperCase()],
              ...(session.slotId ? [['Slot', session.slotId]] : []),
              ['Parked for', (() => {
                const ms = Date.now() - (session.entryTime?.toMillis?.() || Date.now());
                const m = Math.floor(ms / 60000);
                return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
              })()],
            ].map(([k, v]) => (
              <View style={styles.sessionRow} key={k}>
                <Text style={styles.sessionKey}>{k}</Text>
                <Text style={styles.sessionVal}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Payment method */}
          <Text style={styles.label}>PAYMENT METHOD</Text>
          <View style={styles.payRow}>
            {PAY_METHODS.map(pm => (
              <TouchableOpacity
                key={pm.value}
                style={[styles.payBtn, payMethod === pm.value && {
                  borderColor: pm.color, backgroundColor: pm.color + '18'
                }]}
                onPress={() => setPayMethod(pm.value)}
              >
                <Text style={styles.payIcon}>{pm.icon}</Text>
                <Text style={[styles.payLabel, payMethod === pm.value && { color: pm.color }]}>
                  {pm.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {payMethod === 'UPI' && (
            <>
              <Text style={styles.label}>UPI TRANSACTION REF (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                value={upiRef}
                onChangeText={setUpiRef}
                placeholder="e.g. 432XXXXXXXXX"
                placeholderTextColor="#3A506B"
              />
            </>
          )}

          {payMethod === 'Cash' && (
            <>
              <Text style={styles.label}>CASH PROOF PHOTO (REQUIRED)</Text>
              <TouchableOpacity
                style={[styles.photoBtn, cashPhotoUri && styles.photoBtnDone]}
                onPress={pickCashPhoto}
              >
                <Text style={styles.photoBtnText}>
                  {cashPhotoUri ? '✅ Photo Taken — Tap to Retake' : '📸 Take Photo of Cash'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.exitBtn, isSubmitting && styles.exitBtnDisabled]}
            onPress={handleExit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.exitBtnText}>CONFIRM EXIT & COLLECT PAYMENT</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { padding: 20, paddingBottom: 40 },

  lotBadge:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: '#131B2A', borderRadius: 10, padding: 12, marginBottom: 20,
                  borderWidth: 1, borderColor: '#1E2D45' },
  lotBadgeName: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  lotBadgeSub:  { fontSize: 11, color: '#5A7090' },

  scanQrBtn:   { backgroundColor: '#131B2A', borderWidth: 2, borderColor: '#253550',
                 borderStyle: 'dashed', borderRadius: 20, padding: 36, alignItems: 'center' },
  scanQrIcon:  { fontSize: 44, marginBottom: 12 },
  scanQrTitle: { fontSize: 16, fontWeight: '800', color: '#F0F4FF', marginBottom: 4 },
  scanQrSub:   { fontSize: 12, color: '#5A7090' },

  orDivider:   { textAlign: 'center', color: '#253550', marginVertical: 20, fontSize: 12 },

  label:      { fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },

  manualRow:  { flexDirection: 'row', gap: 10 },
  manualInput:{ flex: 1, backgroundColor: '#131B2A', borderWidth: 1, borderColor: '#1E2D45',
                borderRadius: 12, padding: 13, fontSize: 16, color: '#F0F4FF',
                fontFamily: 'monospace', letterSpacing: 2 },
  lookupBtn:  { backgroundColor: '#1E2D45', borderRadius: 12, paddingHorizontal: 16,
                justifyContent: 'center' },
  lookupBtnText:{ fontSize: 12, fontWeight: '700', color: '#F59E0B' },

  sessionCard:    { backgroundColor: '#131B2A', borderRadius: 16, borderWidth: 1,
                    borderColor: '#3B82F6', padding: 18, marginBottom: 4 },
  sessionTopRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  tokenDisplay:   { fontSize: 26, fontWeight: '800', color: '#F0F4FF', fontFamily: 'monospace' },
  clearBtn:       { fontSize: 12, color: '#5A7090', paddingTop: 4 },
  sessionRow:     { flexDirection: 'row', justifyContent: 'space-between',
                    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  sessionKey:     { fontSize: 12, color: '#5A7090' },
  sessionVal:     { fontSize: 12, fontWeight: '700', color: '#F0F4FF' },

  payRow:  { flexDirection: 'row', gap: 8, marginBottom: 4 },
  payBtn:  { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12,
             backgroundColor: '#131B2A', borderWidth: 1.5, borderColor: '#1E2D45' },
  payIcon: { fontSize: 20, marginBottom: 4 },
  payLabel:{ fontSize: 11, fontWeight: '700', color: '#5A7090' },

  input:      { backgroundColor: '#131B2A', borderWidth: 1, borderColor: '#1E2D45',
                borderRadius: 12, padding: 13, fontSize: 14, color: '#F0F4FF' },
  photoBtn:   { backgroundColor: '#131B2A', borderWidth: 1.5, borderColor: '#F59E0B',
                borderRadius: 12, padding: 16, alignItems: 'center' },
  photoBtnDone:{ borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)' },
  photoBtnText:{ fontSize: 13, fontWeight: '700', color: '#F59E0B' },

  exitBtn:        { marginTop: 28, backgroundColor: '#10B981', borderRadius: 14,
                    padding: 16, alignItems: 'center' },
  exitBtnDisabled:{ opacity: 0.5 },
  exitBtnText:    { fontSize: 13, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  // Scanner
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanTitle:   { color: 'white', fontSize: 16, fontWeight: '800', marginBottom: 28 },
  scanFrame:   { width: 230, height: 230, borderWidth: 2, borderColor: '#F59E0B', borderRadius: 14 },
  scanHint:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 20, textAlign: 'center' },
  cancelBtn:   { marginTop: 28, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10,
                 padding: 14, paddingHorizontal: 32 },
  cancelBtnText:{ color: 'white', fontSize: 14, fontWeight: '700' },

  // Success
  successShell: { flex: 1, backgroundColor: '#0A0E1A', alignItems: 'center',
                  justifyContent: 'center', padding: 24 },
  successIcon:  { fontSize: 54, marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#10B981', marginBottom: 24 },
  receiptCard:  { width: '100%', backgroundColor: '#131B2A', borderRadius: 16,
                  borderWidth: 1, borderColor: '#1E2D45', padding: 20 },
  receiptRow:   { flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  receiptKey:   { fontSize: 12, color: '#5A7090' },
  receiptVal:   { fontSize: 14, fontWeight: '700', color: '#F0F4FF' },
  doneBtn:      { marginTop: 24, backgroundColor: '#F59E0B', borderRadius: 12,
                  paddingVertical: 14, paddingHorizontal: 48 },
  doneBtnText:  { fontSize: 14, fontWeight: '800', color: '#000' },
});
