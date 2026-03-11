/**
 * ActiveTokenScreen — Customer App
 * Shows live token if customer has an active parking session.
 * Displays QR, live timer, lot info, estimated charge.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import {
  collection, query, where, onSnapshot, orderBy, limit, getDoc, doc,
} from 'firebase/firestore';
import QRCode     from 'react-native-qrcode-svg';
import { auth, firestore } from '../config/firebase';

interface ActiveSession {
  sessionId:    string;
  tokenNumber:  string;
  plateNumber:  string;
  vehicleType:  string;
  slotId?:      string;
  parkingMode:  string;
  entryTime:    any;
  qrCodeData:   string;
  lotId:        string;
  tenantId:     string;
}

interface LotInfo {
  name:    string;
  address: string;
  rateCard:Record<string, number>;
}

const VEHICLE_ICONS: Record<string, string> = { car: '🚗', bike: '🏍️', auto: '🛺', truck: '🚛' };

export default function ActiveTokenScreen() {
  const user = auth.currentUser;
  const [session,      setSession]      = useState<ActiveSession | null>(null);
  const [lotInfo,      setLotInfo]      = useState<LotInfo | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [nowMs,        setNowMs]        = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live clock — updates every 30s for estimated charge
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Listen for active session across all tenants
  // (customer's phone is used to link session)
  useEffect(() => {
    if (!user) return;

    // Query by customerId first; fall back to customerPhone
    const q = query(
      // We query a collectionGroup since sessions are under tenants
      // For a simpler query, we stored customerId when customer was known
      // Here we use a direct query if the user has a tenantId claim
      collection(firestore, 'users'),
    );

    // Simpler approach: listen to sessions by customerId across user's tenantId
    // Since customers may park at any tenant, we query globally using collectionGroup
    const loadSession = async () => {
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      const userData = userDoc.data();
      if (!userData?.tenantId) { setIsLoading(false); return; }

      const sessionQ = query(
        collection(firestore, 'tenants', userData.tenantId, 'sessions'),
        where('customerId', '==', user.uid),
        where('status', '==', 'active'),
        limit(1)
      );
      return onSnapshot(sessionQ, snap => {
        if (snap.empty) { setSession(null); setIsLoading(false); return; }
        const s = { ...snap.docs[0].data(), sessionId: snap.docs[0].id } as ActiveSession;
        setSession(s);
        setIsLoading(false);
        // Load lot info
        getDoc(doc(firestore, 'tenants', s.tenantId, 'parkingLots', s.lotId)).then(d => {
          if (d.exists()) setLotInfo(d.data() as LotInfo);
        });
      });
    };

    let cleanup: (() => void) | undefined;
    loadSession().then(unsub => { cleanup = unsub; });
    return () => cleanup?.();
  }, [user?.uid]);

  // Live duration & estimated charge
  const getDuration = () => {
    if (!session?.entryTime) return { mins: 0, display: '0m' };
    const ms   = nowMs - session.entryTime.toMillis();
    const mins = Math.floor(ms / 60_000);
    const h    = Math.floor(mins / 60);
    const m    = mins % 60;
    return { mins, display: h > 0 ? `${h}h ${m}m` : `${m}m` };
  };

  const getEstCharge = () => {
    if (!session || !lotInfo) return 0;
    const { mins } = getDuration();
    const rate  = (lotInfo.rateCard?.[session.vehicleType] ?? 30);
    const slabs = Math.ceil(mins / 30);
    return Math.round(slabs * 0.5 * rate);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <ScrollView
        contentContainerStyle={styles.noSessionContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => setIsRefreshing(false)} tintColor="#F59E0B" />}
      >
        <Text style={styles.noSessionIcon}>🅿️</Text>
        <Text style={styles.noSessionTitle}>No Active Parking</Text>
        <Text style={styles.noSessionSub}>
          When an attendant scans your vehicle or you provide your number, your active token will appear here.
        </Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>How it works</Text>
          <Text style={styles.tipText}>1. Drive in and give your mobile number to the attendant</Text>
          <Text style={styles.tipText}>2. Your token appears here automatically</Text>
          <Text style={styles.tipText}>3. Show QR at exit for quick checkout</Text>
        </View>
      </ScrollView>
    );
  }

  const dur      = getDuration();
  const estCharge = getEstCharge();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Live badge */}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE PARKING</Text>
      </View>

      {/* Token display */}
      <View style={styles.tokenCard}>
        <Text style={styles.lotName}>{lotInfo?.name || 'Parking Lot'}</Text>
        <Text style={styles.lotAddress}>{lotInfo?.address}</Text>

        <Text style={styles.tokenNumber}>{session.tokenNumber}</Text>

        {session.slotId && (
          <View style={styles.slotBadge}>
            <Text style={styles.slotBadgeText}>Slot {session.slotId}</Text>
          </View>
        )}

        {/* QR Code */}
        <View style={styles.qrWrapper}>
          <QRCode value={session.qrCodeData} size={180} backgroundColor="white" color="#0A0E1A" />
        </View>
        <Text style={styles.qrHint}>Show this QR code at the exit</Text>
      </View>

      {/* Live stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{dur.display}</Text>
          <Text style={styles.statLabel}>Parked For</Text>
        </View>
        <View style={[styles.statBox, { borderColor: '#F59E0B' }]}>
          <Text style={[styles.statVal, { color: '#F59E0B' }]}>₹{estCharge}</Text>
          <Text style={styles.statLabel}>Est. Charge</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{VEHICLE_ICONS[session.vehicleType] || '🚗'}</Text>
          <Text style={styles.statLabel}>{session.vehicleType}</Text>
        </View>
      </View>

      {/* Vehicle info */}
      <View style={styles.infoCard}>
        {[
          ['Vehicle',     session.plateNumber],
          ['Entry Time',  session.entryTime?.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })],
          ['Parking Mode',session.parkingMode === 'slot_based' ? 'Assigned Slot' : 'Open Parking'],
        ].map(([k, v]) => (
          <View style={styles.infoRow} key={k}>
            <Text style={styles.infoKey}>{k}</Text>
            <Text style={styles.infoVal}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Estimated charge updates every 30 minutes. Final amount calculated at exit.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { padding: 20, paddingBottom: 40, alignItems: 'center' },
  center:     { flex: 1, backgroundColor: '#0A0E1A', alignItems: 'center', justifyContent: 'center' },

  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
                backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 6 },
  liveDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveText:   { fontSize: 11, fontWeight: '800', color: '#10B981', letterSpacing: 2 },

  tokenCard:  { width: '100%', backgroundColor: '#131B2A', borderRadius: 24,
                borderWidth: 1, borderColor: '#1E2D45', padding: 24, alignItems: 'center',
                marginBottom: 16 },
  lotName:    { fontSize: 14, fontWeight: '700', color: '#F59E0B', marginBottom: 2 },
  lotAddress: { fontSize: 11, color: '#5A7090', marginBottom: 20, textAlign: 'center' },
  tokenNumber:{ fontSize: 48, fontWeight: '900', color: '#F0F4FF', letterSpacing: 4,
                fontFamily: 'monospace', marginBottom: 8 },
  slotBadge:  { backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8,
                paddingHorizontal: 14, paddingVertical: 4, marginBottom: 20 },
  slotBadgeText:{ fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  qrWrapper:  { backgroundColor: 'white', padding: 14, borderRadius: 14, marginBottom: 10 },
  qrHint:     { fontSize: 11, color: '#5A7090' },

  statsRow:   { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 },
  statBox:    { flex: 1, backgroundColor: '#131B2A', borderRadius: 14, borderWidth: 1,
                borderColor: '#1E2D45', padding: 14, alignItems: 'center' },
  statVal:    { fontSize: 20, fontWeight: '800', color: '#10B981', marginBottom: 4 },
  statLabel:  { fontSize: 10, color: '#5A7090', fontWeight: '600' },

  infoCard:   { width: '100%', backgroundColor: '#131B2A', borderRadius: 14,
                borderWidth: 1, borderColor: '#1E2D45', padding: 16, marginBottom: 16 },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  infoKey:    { fontSize: 12, color: '#5A7090' },
  infoVal:    { fontSize: 12, fontWeight: '700', color: '#F0F4FF' },
  disclaimer: { fontSize: 11, color: '#3A506B', textAlign: 'center', lineHeight: 18 },

  // No session
  noSessionContainer: { flexGrow: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  noSessionIcon:      { fontSize: 60, marginBottom: 16 },
  noSessionTitle:     { fontSize: 20, fontWeight: '800', color: '#F0F4FF', marginBottom: 10 },
  noSessionSub:       { fontSize: 13, color: '#5A7090', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  tipCard:    { width: '100%', backgroundColor: '#131B2A', borderRadius: 16,
                borderWidth: 1, borderColor: '#1E2D45', padding: 20 },
  tipTitle:   { fontSize: 13, fontWeight: '700', color: '#F0F4FF', marginBottom: 12 },
  tipText:    { fontSize: 12, color: '#5A7090', lineHeight: 22 },
});
