/**
 * VehicleEntryScreen — Attendant App
 * Handles BOTH parking modes:
 *  - slot_based:      shows slot picker, assigns specific slot
 *  - capacity_based:  shows current count/capacity, no slot selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import { httpsCallable }                          from 'firebase/functions';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL }       from 'firebase/storage';
import { functions, firestore, storage }          from '../config/firebase';
import { useAuth }                                from '../hooks/useAuth';
import { useCameraOCR }                           from '../hooks/useCameraOCR';
import QRCode                                     from 'react-native-qrcode-svg';

type VehicleType = 'car' | 'bike' | 'auto' | 'truck';
type ParkingMode = 'slot_based' | 'capacity_based';

interface ActiveLot {
  lotId:         string;
  name:          string;
  parkingMode:   ParkingMode;
  totalCapacity?: number;
  currentCount?:  number;
  allowOverflow?: boolean;
}

interface SlotDoc { slotId: string; status: string; }

interface EntryResult {
  sessionId:                   string;
  tokenNumber:                 string;
  qrCodeData:                  string;
  slotId?:                     string;
  entryTime:                   string;
  estimatedRate:               number;
  isOverflow:                  boolean;
  currentCount?:               number;
  capacity?:                   number;
  requiresOverrideConfirmation?:boolean;
  message?:                    string;
}

const VEHICLE_TYPES = [
  { value: 'car' as VehicleType,   icon: '🚗', label: 'Car',   color: '#3B82F6' },
  { value: 'bike' as VehicleType,  icon: '🏍️', label: 'Bike',  color: '#10B981' },
  { value: 'auto' as VehicleType,  icon: '🛺', label: 'Auto',  color: '#F59E0B' },
  { value: 'truck' as VehicleType, icon: '🚛', label: 'Truck', color: '#EF4444' },
];

interface Props { shiftId: string; activeLot: ActiveLot; }

export default function VehicleEntryScreen({ shiftId, activeLot }: Props) {
  const { user }                               = useAuth();
  const { scanPlate, isScanning, capturedImageUri } = useCameraOCR();

  const [plateNumber,   setPlateNumber]   = useState('');
  const [vehicleType,   setVehicleType]   = useState<VehicleType>('car');
  const [selectedSlot,  setSelectedSlot]  = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [freeSlots,     setFreeSlots]     = useState<SlotDoc[]>([]);
  const [entryResult,   setEntryResult]   = useState<EntryResult | null>(null);

  const isSlotBased = activeLot.parkingMode === 'slot_based';

  // Live free slots (slot_based only)
  useEffect(() => {
    if (!isSlotBased || !user?.tenantId) return;
    const q = query(
      collection(firestore, 'tenants', user.tenantId, 'parkingLots', activeLot.lotId, 'slots'),
      where('status', '==', 'free'),
      orderBy('slotId')
    );
    const unsub = onSnapshot(q, snap => {
      const slots = snap.docs.map(d => d.data() as SlotDoc);
      setFreeSlots(slots);
      if (slots.length > 0 && !selectedSlot) setSelectedSlot(slots[0].slotId);
    });
    return unsub;
  }, [isSlotBased, user?.tenantId, activeLot.lotId]);

  const handleScan = useCallback(async () => {
    const result = await scanPlate();
    if (result) setPlateNumber(result);
    else Alert.alert('Not Detected', 'Could not read plate. Please type manually.');
  }, [scanPlate]);

  const doEntry = async (overrideCapacity = false) => {
    if (!user) return;
    const normPlate = plateNumber.replace(/[\s\-]/g, '').toUpperCase();
    if (normPlate.length < 6) {
      Alert.alert('Error', 'Please enter a valid vehicle plate number.');
      return;
    }
    if (isSlotBased && !selectedSlot) {
      Alert.alert('Error', 'Please select a parking slot.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fn = httpsCallable<object, EntryResult>(functions, 'vehicleEntry');
      const result = await fn({
        tenantId:         user.tenantId,
        lotId:            activeLot.lotId,
        slotId:           isSlotBased ? selectedSlot : undefined,
        plateNumber:      normPlate,
        vehicleType,
        shiftId,
        customerPhone:    customerPhone.trim() || undefined,
        overrideCapacity,
      });

      // Overflow confirmation needed
      if (result.data.requiresOverrideConfirmation) {
        Alert.alert(
          '⚠️ Parking Full',
          result.data.message || 'Parking is at capacity. Proceed with overflow?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed Anyway', onPress: () => doEntry(true) },
          ]
        );
        return;
      }

      // Upload entry image
      if (capturedImageUri && result.data.sessionId) {
        try {
          const resp    = await fetch(capturedImageUri);
          const blob    = await resp.blob();
          const fileRef = ref(storage,
            `tenants/${user.tenantId}/sessions/${result.data.sessionId}/entry.jpg`);
          await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
        } catch { /* non-critical */ }
      }

      setEntryResult(result.data);
    } catch (err: any) {
      Alert.alert('Entry Failed', err.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setPlateNumber(''); setVehicleType('car');
    setSelectedSlot(null); setCustomerPhone('');
    setEntryResult(null);
  };

  // ── Token success ────────────────────────────────────────────────────────

  if (entryResult) {
    return (
      <View style={styles.tokenContainer}>
        {entryResult.isOverflow && (
          <View style={styles.overflowBanner}>
            <Text style={styles.overflowText}>⚠️ OVERFLOW ENTRY — Parking was full</Text>
          </View>
        )}
        <Text style={styles.successLabel}>✅ Entry Confirmed</Text>
        <View style={styles.tokenCard}>
          <Text style={styles.tokenNumber}>{entryResult.tokenNumber}</Text>
          {entryResult.slotId
            ? <Text style={styles.tokenSub}>Slot {entryResult.slotId}</Text>
            : <Text style={styles.tokenSub}>{activeLot.name}</Text>
          }
          <View style={styles.qrBox}>
            <QRCode value={entryResult.qrCodeData} size={150} backgroundColor="white" color="#0A0E1A" />
          </View>
          {[
            ['Vehicle',    plateNumber.toUpperCase()],
            ['Type',       vehicleType],
            ['Entry Time', new Date(entryResult.entryTime).toLocaleTimeString('en-IN')],
            ['Rate',       `₹${entryResult.estimatedRate}/hr`],
            ...(entryResult.currentCount !== undefined
              ? [['Lot Count', `${entryResult.currentCount}/${entryResult.capacity}`]]
              : []),
          ].map(([k, v]) => (
            <View style={styles.metaRow} key={k}>
              <Text style={styles.metaKey}>{k}</Text>
              <Text style={styles.metaVal}>{v}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.newEntryBtn} onPress={reset}>
          <Text style={styles.newEntryBtnText}>+ New Entry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Entry form ───────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.lotBadge}>
        <Text style={styles.lotBadgeName}>{activeLot.name}</Text>
        {!isSlotBased && (
          <Text style={styles.lotBadgeCount}>
            {activeLot.currentCount ?? 0}/{activeLot.totalCapacity ?? '?'} vehicles
          </Text>
        )}
      </View>

      {/* PLATE */}
      <Text style={styles.label}>PLATE NUMBER</Text>
      <View style={styles.plateRow}>
        <TextInput
          style={styles.plateInput}
          value={plateNumber}
          onChangeText={v => setPlateNumber(v.toUpperCase())}
          placeholder="MH 12 AB 4567"
          placeholderTextColor="#4B6075"
          autoCapitalize="characters"
          maxLength={12}
        />
        <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={isScanning}>
          {isScanning
            ? <ActivityIndicator color="#F59E0B" />
            : <Text style={styles.scanBtnText}>📷</Text>
          }
        </TouchableOpacity>
      </View>
      {capturedImageUri && (
        <Image source={{ uri: capturedImageUri }} style={styles.capturedThumb} />
      )}

      {/* VEHICLE TYPE */}
      <Text style={styles.label}>VEHICLE TYPE</Text>
      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map(vt => (
          <TouchableOpacity
            key={vt.value}
            style={[styles.typeBtn, vehicleType === vt.value && { borderColor: vt.color, backgroundColor: `${vt.color}15` }]}
            onPress={() => setVehicleType(vt.value)}
          >
            <Text style={styles.typeIcon}>{vt.icon}</Text>
            <Text style={[styles.typeLabel, vehicleType === vt.value && { color: vt.color }]}>{vt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SLOT SELECTION — slot_based only */}
      {isSlotBased && (
        <>
          <Text style={styles.label}>SLOT ({freeSlots.length} FREE)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {freeSlots.length === 0
              ? <Text style={styles.noSlots}>⚠️ No free slots</Text>
              : freeSlots.map(s => (
                <TouchableOpacity
                  key={s.slotId}
                  style={[styles.slotChip, selectedSlot === s.slotId && styles.slotChipSelected]}
                  onPress={() => setSelectedSlot(s.slotId)}
                >
                  <Text style={[styles.slotChipText, selectedSlot === s.slotId && { color: '#10B981' }]}>
                    {s.slotId}
                  </Text>
                </TouchableOpacity>
              ))
            }
          </ScrollView>
        </>
      )}

      {/* CAPACITY INFO — capacity_based only */}
      {!isSlotBased && (
        <View style={styles.capacityCard}>
          <Text style={styles.capacityLabel}>Current Occupancy</Text>
          <Text style={styles.capacityCount}>
            {activeLot.currentCount ?? 0}
            <Text style={styles.capacityTotal}>/{activeLot.totalCapacity ?? '?'}</Text>
          </Text>
          {(activeLot.currentCount ?? 0) >= (activeLot.totalCapacity ?? 999) && (
            <Text style={styles.capacityFull}>
              {activeLot.allowOverflow ? '⚠️ Full — overflow allowed with confirmation' : '🚫 Parking is full'}
            </Text>
          )}
        </View>
      )}

      {/* CUSTOMER PHONE */}
      <Text style={styles.label}>CUSTOMER MOBILE (OPTIONAL)</Text>
      <TextInput
        style={styles.input}
        value={customerPhone}
        onChangeText={setCustomerPhone}
        placeholder="+91 98XXXXXXXX"
        placeholderTextColor="#4B6075"
        keyboardType="phone-pad"
        maxLength={13}
      />

      {/* SUBMIT */}
      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={() => doEntry(false)}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.submitBtnText}>CONFIRM ENTRY & GENERATE TOKEN</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const S = StyleSheet.create;
const styles = S({
  scroll: { flex: 1, backgroundColor: '#0A0E1A' },
  container: { padding: 20, paddingBottom: 40 },

  lotBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#131B2A', borderRadius: 10, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#1E2D45' },
  lotBadgeName:  { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  lotBadgeCount: { fontSize: 12, color: '#5A7090' },

  label: { fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1.5, marginBottom: 8, marginTop: 20 },

  plateRow:   { flexDirection: 'row', gap: 10 },
  plateInput: { flex: 1, backgroundColor: '#131B2A', borderWidth: 1.5, borderColor: '#F59E0B',
    borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '700', color: '#F0F4FF',
    letterSpacing: 2, fontFamily: 'monospace' },
  scanBtn:    { backgroundColor: '#1E2D45', borderRadius: 12, width: 54, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: '#253550' },
  scanBtnText:{ fontSize: 22 },
  capturedThumb: { width: '100%', height: 70, borderRadius: 8, marginTop: 8, resizeMode: 'cover' },

  typeRow:  { flexDirection: 'row', gap: 8 },
  typeBtn:  { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: '#131B2A', borderWidth: 1.5, borderColor: '#1E2D45' },
  typeIcon: { fontSize: 22, marginBottom: 4 },
  typeLabel:{ fontSize: 11, fontWeight: '700', color: '#5A7090' },

  slotChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#131B2A', borderWidth: 1, borderColor: '#1E2D45', marginRight: 8 },
  slotChipSelected: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' },
  slotChipText: { fontSize: 13, fontWeight: '700', color: '#5A7090', fontFamily: 'monospace' },
  noSlots: { color: '#EF4444', fontSize: 13, padding: 10 },

  capacityCard: { backgroundColor: '#131B2A', borderRadius: 12, borderWidth: 1,
    borderColor: '#253550', padding: 16 },
  capacityLabel:{ fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1 },
  capacityCount:{ fontSize: 36, fontWeight: '800', color: '#10B981', marginTop: 4 },
  capacityTotal:{ fontSize: 24, fontWeight: '400', color: '#5A7090' },
  capacityFull: { fontSize: 12, color: '#F59E0B', marginTop: 6 },

  input: { backgroundColor: '#131B2A', borderWidth: 1, borderColor: '#1E2D45',
    borderRadius: 12, padding: 14, fontSize: 14, color: '#F0F4FF' },

  submitBtn: { marginTop: 32, backgroundColor: '#F59E0B', borderRadius: 14, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 13, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  // Token result
  tokenContainer: { flex: 1, backgroundColor: '#0A0E1A', padding: 20, alignItems: 'center' },
  overflowBanner: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10,
    padding: 10, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  overflowText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  successLabel: { fontSize: 18, fontWeight: '800', color: '#10B981', marginVertical: 16 },
  tokenCard:    { width: '100%', backgroundColor: '#131B2A', borderRadius: 20,
    borderWidth: 1, borderColor: '#253550', padding: 24, alignItems: 'center' },
  tokenNumber:  { fontSize: 42, fontWeight: '800', color: '#F0F4FF', letterSpacing: 4, fontFamily: 'monospace' },
  tokenSub:     { fontSize: 13, color: '#5A7090', marginBottom: 20, marginTop: 4 },
  qrBox:        { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 20 },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  metaKey:      { fontSize: 12, color: '#5A7090', textTransform: 'capitalize' },
  metaVal:      { fontSize: 12, fontWeight: '700', color: '#F0F4FF' },
  newEntryBtn:  { marginTop: 24, backgroundColor: '#1E2D45', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40 },
  newEntryBtnText: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
});
