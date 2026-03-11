/**
 * ShiftStartScreen — Attendant App
 *
 * Attendant selects which lot they're working at today (from their assignedLotIds).
 * Calls startShift Cloud Function → returns shiftId.
 * Stored in app state for the entire shift session.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { httpsCallable }      from 'firebase/functions';
import { doc, getDoc }        from 'firebase/firestore';
import { functions, firestore } from '../config/firebase';
import { useAuth }              from '../hooks/useAuth';

interface ParkingLot {
  lotId:       string;
  name:        string;
  address:     string;
  city:        string;
  parkingMode: 'slot_based' | 'capacity_based';
  totalCapacity?:number;
  currentCount?: number;
  totalSlots?:   number;
  isActive:    boolean;
}

interface Props {
  onShiftStarted: (shiftId: string, lot: ParkingLot) => void;
}

export default function ShiftStartScreen({ onShiftStarted }: Props) {
  const { user } = useAuth();
  const [lots,        setLots]        = useState<ParkingLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isStarting,  setIsStarting]  = useState(false);

  // Load all lots assigned to this attendant
  useEffect(() => {
    if (!user?.tenantId || !user.assignedLotIds?.length) {
      setIsLoading(false);
      return;
    }

    const fetchLots = async () => {
      try {
        const lotDocs = await Promise.all(
          user.assignedLotIds.map(lotId =>
            getDoc(doc(firestore, 'tenants', user.tenantId, 'parkingLots', lotId))
          )
        );
        const loaded = lotDocs
          .filter(d => d.exists())
          .map(d => ({ ...d.data(), lotId: d.id }) as ParkingLot)
          .filter(l => l.isActive);
        setLots(loaded);
        if (loaded.length === 1) setSelectedLot(loaded[0]); // auto-select if only one
      } catch (e) {
        Alert.alert('Error', 'Could not load your assigned lots.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLots();
  }, [user]);

  const handleStartShift = async () => {
    if (!selectedLot || !user) return;
    setIsStarting(true);
    try {
      const startShiftFn = httpsCallable<object, { shiftId: string }>(functions, 'startShift');
      const result = await startShiftFn({
        tenantId: user.tenantId,
        lotId:    selectedLot.lotId,
      });
      onShiftStarted(result.data.shiftId, selectedLot);
    } catch (err: any) {
      Alert.alert('Cannot Start Shift', err.message || 'Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  if (!user?.tenantId) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningTitle}>Account Not Configured</Text>
        <Text style={styles.warningDesc}>
          Your account has not been assigned to a parking tenant yet.{'\n'}
          Ask your parking lot owner to assign you.
        </Text>
      </View>
    );
  }

  if (user.tenantStatus === 'pending_approval') {
    return (
      <View style={styles.center}>
        <Text style={styles.warningIcon}>⏳</Text>
        <Text style={styles.warningTitle}>Approval Pending</Text>
        <Text style={styles.warningDesc}>
          Your business account is pending approval from ParkSmart admin.
          You'll be notified once approved.
        </Text>
      </View>
    );
  }

  if (user.tenantStatus === 'suspended') {
    return (
      <View style={styles.center}>
        <Text style={styles.warningIcon}>🚫</Text>
        <Text style={styles.warningTitle}>Account Suspended</Text>
        <Text style={styles.warningDesc}>Contact support to restore access.</Text>
      </View>
    );
  }

  if (lots.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningIcon}>🏗️</Text>
        <Text style={styles.warningTitle}>No Lots Assigned</Text>
        <Text style={styles.warningDesc}>
          Ask your owner to assign you to a parking location.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Good {getGreeting()},</Text>
      <Text style={styles.name}>{user.displayFullName || 'Attendant'}</Text>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>SELECT YOUR LOCATION TODAY</Text>

      {lots.map(lot => (
        <TouchableOpacity
          key={lot.lotId}
          style={[styles.lotCard, selectedLot?.lotId === lot.lotId && styles.lotCardSelected]}
          onPress={() => setSelectedLot(lot)}
          activeOpacity={0.7}
        >
          <View style={styles.lotCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lotName}>{lot.name}</Text>
              <Text style={styles.lotAddress}>{lot.address}, {lot.city}</Text>
              <View style={styles.lotTags}>
                <View style={[styles.modeTag, { backgroundColor: lot.parkingMode === 'slot_based' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                  <Text style={[styles.modeTagText, { color: lot.parkingMode === 'slot_based' ? '#3B82F6' : '#10B981' }]}>
                    {lot.parkingMode === 'slot_based' ? '🔢 Slot-based' : '📊 Capacity-based'}
                  </Text>
                </View>
                {lot.parkingMode === 'capacity_based' && (
                  <View style={styles.countTag}>
                    <Text style={styles.countTagText}>
                      {lot.currentCount ?? 0}/{lot.totalCapacity ?? 0} vehicles
                    </Text>
                  </View>
                )}
                {lot.parkingMode === 'slot_based' && lot.totalSlots && (
                  <View style={styles.countTag}>
                    <Text style={styles.countTagText}>{lot.totalSlots} slots</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.radioOuter, selectedLot?.lotId === lot.lotId && styles.radioOuterSelected]}>
              {selectedLot?.lotId === lot.lotId && <View style={styles.radioInner} />}
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.startBtn, (!selectedLot || isStarting) && styles.startBtnDisabled]}
        onPress={handleStartShift}
        disabled={!selectedLot || isStarting}
      >
        {isStarting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.startBtnText}>START SHIFT AT {selectedLot?.name.toUpperCase() || '...'}</Text>
        }
      </TouchableOpacity>

      <Text style={styles.hint}>
        Your shift will be tracked for reconciliation. You can end it from the menu.
      </Text>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { padding: 24, paddingBottom: 40 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#0A0E1A', padding: 32 },

  greeting:   { fontSize: 15, color: '#5A7090', marginBottom: 2 },
  name:       { fontSize: 28, fontWeight: '800', color: '#F0F4FF', letterSpacing: -0.5 },
  divider:    { height: 1, backgroundColor: '#1E2D45', marginVertical: 28 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2,
                  color: '#5A7090', marginBottom: 16 },

  lotCard: {
    backgroundColor: '#131B2A', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#1E2D45',
    padding: 18, marginBottom: 12,
  },
  lotCardSelected: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.06)' },
  lotCardRow:    { flexDirection: 'row', alignItems: 'center' },
  lotName:       { fontSize: 15, fontWeight: '800', color: '#F0F4FF', marginBottom: 4 },
  lotAddress:    { fontSize: 12, color: '#5A7090', marginBottom: 10 },
  lotTags:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeTag:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modeTagText:   { fontSize: 11, fontWeight: '700' },
  countTag:      { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6,
                   paddingHorizontal: 8, paddingVertical: 3 },
  countTagText:  { fontSize: 11, color: '#5A7090' },

  radioOuter:  { width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                 borderColor: '#253550', alignItems: 'center', justifyContent: 'center',
                 marginLeft: 12 },
  radioOuterSelected: { borderColor: '#F59E0B' },
  radioInner:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' },

  startBtn: {
    marginTop: 24, backgroundColor: '#F59E0B', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 13, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  hint: { fontSize: 11, color: '#5A7090', textAlign: 'center', marginTop: 16, lineHeight: 18 },

  warningIcon:  { fontSize: 48, marginBottom: 16 },
  warningTitle: { fontSize: 18, fontWeight: '800', color: '#F0F4FF', marginBottom: 8, textAlign: 'center' },
  warningDesc:  { fontSize: 13, color: '#5A7090', textAlign: 'center', lineHeight: 20 },
});
