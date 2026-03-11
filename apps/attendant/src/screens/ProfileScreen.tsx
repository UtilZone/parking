/**
 * ProfileScreen — Attendant App
 * Shows shift summary, active lot, account info. End shift button.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { httpsCallable }  from 'firebase/functions';
import { functions }      from '../config/firebase';
import { useAuth }        from '../hooks/useAuth';
import type { ActiveShift } from '../navigation/RootNavigator';

interface Props {
  activeShift: ActiveShift;
  onEndShift:  () => void;
}

export default function ProfileScreen({ activeShift, onEndShift }: Props) {
  const { user, signOut }    = useAuth();
  const [isEnding, setIsEnding] = useState(false);

  const handleEndShift = () => {
    Alert.alert(
      'End Shift',
      'This will finalise your shift and run reconciliation. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Shift', style: 'destructive', onPress: doEndShift },
      ]
    );
  };

  const doEndShift = async () => {
    if (!user?.tenantId) return;
    setIsEnding(true);
    try {
      const fn = httpsCallable<object, {
        shiftId: string; totalRevenue: number;
        expectedRevenue: number; discrepancy: number; status: string;
      }>(functions, 'endShift');

      const result = await fn({
        tenantId: user.tenantId,
        shiftId:  activeShift.shiftId,
      });

      const { totalRevenue, expectedRevenue, discrepancy, status } = result.data;

      if (status === 'flagged') {
        Alert.alert(
          '⚠️ Shift Flagged',
          `Discrepancy of ₹${Math.abs(discrepancy)} detected.\n` +
          `Collected: ₹${totalRevenue} | Expected: ₹${expectedRevenue}\n\n` +
          `Your supervisor has been notified.`,
          [{ text: 'OK', onPress: onEndShift }]
        );
      } else {
        Alert.alert(
          '✅ Shift Closed',
          `Great work!\nTotal revenue: ₹${totalRevenue}\nNo discrepancies found.`,
          [{ text: 'OK', onPress: onEndShift }]
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not end shift.');
    } finally {
      setIsEnding(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Your shift will remain open. Sign out anyway?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Profile header */}
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {user?.displayFullName?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.displayFullName || 'Attendant'}</Text>
          <Text style={styles.userPhone}>{user?.phoneNumber}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>🎫 ATTENDANT</Text>
          </View>
        </View>
      </View>

      {/* Active shift card */}
      <View style={styles.shiftCard}>
        <Text style={styles.shiftCardTitle}>Active Shift</Text>
        {[
          ['Shift ID',  activeShift.shiftId.slice(0, 12) + '…'],
          ['Location',  activeShift.lot.name],
          ['Mode',      activeShift.lot.parkingMode === 'slot_based' ? '🔢 Slot-based' : '📊 Capacity-based'],
          ['Started',   new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })],
        ].map(([k, v]) => (
          <View style={styles.shiftRow} key={k}>
            <Text style={styles.shiftKey}>{k}</Text>
            <Text style={styles.shiftVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* End shift */}
      <TouchableOpacity
        style={[styles.endShiftBtn, isEnding && styles.btnDisabled]}
        onPress={handleEndShift}
        disabled={isEnding}
      >
        {isEnding
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.endShiftBtnText}>🏁 End Shift & Reconcile</Text>
        }
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* App info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>App Info</Text>
        {[
          ['Version',  'ParkSmart Attendant v1.0'],
          ['Package',  'com.utilzone.parking.attendant'],
          ['Tenant',   user?.tenantId?.slice(0, 16) + '…' || '—'],
        ].map(([k, v]) => (
          <View style={styles.infoRow} key={k}>
            <Text style={styles.infoKey}>{k}</Text>
            <Text style={styles.infoVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { padding: 24, paddingBottom: 40 },

  avatarRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar:     { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1E2D45',
                alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F59E0B' },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: '#F59E0B' },
  userName:   { fontSize: 18, fontWeight: '800', color: '#F0F4FF', marginBottom: 2 },
  userPhone:  { fontSize: 13, color: '#5A7090', marginBottom: 6, fontFamily: 'monospace' },
  roleBadge:  { backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6,
                paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 1 },

  shiftCard:      { backgroundColor: '#131B2A', borderRadius: 16, borderWidth: 1,
                    borderColor: '#10B981', padding: 18, marginBottom: 20 },
  shiftCardTitle: { fontSize: 12, fontWeight: '700', color: '#10B981',
                    letterSpacing: 1, marginBottom: 12 },
  shiftRow:       { flexDirection: 'row', justifyContent: 'space-between',
                    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  shiftKey:       { fontSize: 12, color: '#5A7090' },
  shiftVal:       { fontSize: 12, fontWeight: '700', color: '#F0F4FF', maxWidth: '60%', textAlign: 'right' },

  endShiftBtn:     { backgroundColor: '#EF4444', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDisabled:     { opacity: 0.5 },
  endShiftBtnText: { fontSize: 14, fontWeight: '800', color: 'white', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: '#1E2D45', marginVertical: 28 },

  infoSection: { marginBottom: 24 },
  infoTitle:   { fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1.5, marginBottom: 12 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  infoKey:     { fontSize: 12, color: '#5A7090' },
  infoVal:     { fontSize: 11, color: '#3A506B', fontFamily: 'monospace' },

  signOutBtn:     { backgroundColor: '#131B2A', borderRadius: 12, borderWidth: 1,
                    borderColor: '#1E2D45', padding: 14, alignItems: 'center' },
  signOutBtnText: { fontSize: 14, fontWeight: '700', color: '#5A7090' },
});
