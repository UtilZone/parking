/**
 * ParkingHistoryScreen — Customer App
 * Past sessions with amounts, duration, and lot info.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

interface HistoryItem {
  sessionId:    string;
  tokenNumber:  string;
  plateNumber:  string;
  vehicleType:  string;
  lotId:        string;
  tenantId:     string;
  entryTime:    any;
  exitTime:     any;
  durationMinutes: number;
  chargeAmount: number;
  paymentMethod:string;
  status:       string;
  lotName?:     string;
}

const VEHICLE_ICONS: Record<string, string> = { car: '🚗', bike: '🏍️', auto: '🛺', truck: '🚛' };
const PAY_ICONS: Record<string, string>     = { UPI: '📱', Cash: '💵', Card: '💳', Wallet: '👛' };

export default function ParkingHistoryScreen() {
  const user = auth.currentUser;
  const [items,     setItems]     = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      const tenantId = userDoc.data()?.tenantId;
      if (!tenantId) { setIsLoading(false); return; }

      const q = query(
        collection(firestore, 'tenants', tenantId, 'sessions'),
        where('customerId', '==', user.uid),
        where('status', '==', 'completed'),
        orderBy('exitTime', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const sessions = snap.docs.map(d => ({ ...d.data(), sessionId: d.id }) as HistoryItem);

      // Fetch lot names
      const uniqueLots = [...new Set(sessions.map(s => s.lotId))];
      const lotNames: Record<string, string> = {};
      await Promise.all(uniqueLots.map(async lotId => {
        const ld = await getDoc(doc(firestore, 'tenants', tenantId, 'parkingLots', lotId));
        if (ld.exists()) lotNames[lotId] = ld.data().name;
      }));

      setItems(sessions.map(s => ({ ...s, lotName: lotNames[s.lotId] || 'Parking Lot' })));
      setIsLoading(false);
    };
    load();
  }, [user?.uid]);

  const fmtDate = (ts: any) => ts?.toDate?.().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) || '—';

  const fmtDur  = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;

  const totalSpent = items.reduce((s, i) => s + (i.chargeAmount ?? 0), 0);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#F59E0B" size="large" /></View>;
  }

  return (
    <View style={styles.shell}>
      {/* Total */}
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Spent (All Time)</Text>
        <Text style={styles.totalAmount}>₹{totalSpent.toLocaleString('en-IN')}</Text>
        <Text style={styles.totalCount}>{items.length} sessions</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🅿️</Text>
          <Text style={styles.emptyText}>No parking history yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.sessionId}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.leftCol}>
                  <Text style={styles.lotName}>{item.lotName}</Text>
                  <Text style={styles.dateText}>{fmtDate(item.entryTime)}</Text>
                </View>
                <Text style={styles.amount}>₹{item.chargeAmount}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaChip}>{VEHICLE_ICONS[item.vehicleType]} {item.plateNumber}</Text>
                <Text style={styles.metaChip}>⏱ {fmtDur(item.durationMinutes)}</Text>
                <Text style={styles.metaChip}>{PAY_ICONS[item.paymentMethod] || '💳'} {item.paymentMethod}</Text>
                <Text style={styles.metaChip}>🎫 {item.tokenNumber}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell:       { flex: 1, backgroundColor: '#0A0E1A' },
  center:      { flex: 1, backgroundColor: '#0A0E1A', alignItems: 'center', justifyContent: 'center' },
  totalBanner: { backgroundColor: '#0E1420', borderBottomWidth: 1, borderBottomColor: '#1E2D45',
                 padding: 20, alignItems: 'center' },
  totalLabel:  { fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1.5 },
  totalAmount: { fontSize: 32, fontWeight: '900', color: '#F59E0B', marginTop: 4 },
  totalCount:  { fontSize: 11, color: '#5A7090', marginTop: 2 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon:   { fontSize: 40, marginBottom: 12 },
  emptyText:   { fontSize: 14, color: '#5A7090' },
  card:        { backgroundColor: '#131B2A', borderRadius: 14, borderWidth: 1,
                 borderColor: '#1E2D45', padding: 16, marginBottom: 10 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  leftCol:     { flex: 1 },
  lotName:     { fontSize: 14, fontWeight: '700', color: '#F0F4FF', marginBottom: 3 },
  dateText:    { fontSize: 11, color: '#5A7090' },
  amount:      { fontSize: 20, fontWeight: '800', color: '#10B981' },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip:    { backgroundColor: '#0E1420', borderRadius: 7, paddingHorizontal: 10,
                 paddingVertical: 4, fontSize: 11, color: '#7A90A8' },
});
