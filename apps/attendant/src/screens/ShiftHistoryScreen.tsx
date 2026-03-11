/**
 * ShiftHistoryScreen — Attendant App
 * Live list of sessions in the current shift: active + completed.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { useAuth }   from '../hooks/useAuth';

interface Session {
  sessionId:    string;
  tokenNumber:  string;
  plateNumber:  string;
  vehicleType:  string;
  slotId?:      string;
  parkingMode:  string;
  entryTime:    any;
  exitTime?:    any;
  chargeAmount: number | null;
  paymentMethod:string | null;
  status:       string;
}

interface Props {
  shiftId:   string;
  activeLot: { lotId: string; name: string };
}

const VEHICLE_ICONS: Record<string, string> = {
  car: '🚗', bike: '🏍️', auto: '🛺', truck: '🚛',
};

export default function ShiftHistoryScreen({ shiftId, activeLot }: Props) {
  const { user }     = useAuth();
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [filter,     setFilter]     = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collection(firestore, 'tenants', user.tenantId, 'sessions'),
      where('shiftId', '==', shiftId),
      orderBy('entryTime', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ ...d.data(), sessionId: d.id }) as Session));
      setIsLoading(false);
    });
    return unsub;
  }, [user?.tenantId, shiftId]);

  const filtered = filter === 'all' ? sessions
    : sessions.filter(s => s.status === filter);

  const activeCount    = sessions.filter(s => s.status === 'active').length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const totalRevenue   = sessions
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (s.chargeAmount ?? 0), 0);

  const fmtTime = (ts: any) => {
    if (!ts?.toDate) return '—';
    return ts.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const fmtDur = (entry: any, exit: any) => {
    if (!entry?.toMillis || !exit?.toMillis) return '—';
    const m = Math.floor((exit.toMillis() - entry.toMillis()) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
  };

  return (
    <View style={styles.shell}>
      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Active',    value: activeCount,    color: '#10B981' },
          { label: 'Completed', value: completedCount, color: '#3B82F6' },
          { label: 'Revenue',   value: `₹${totalRevenue}`, color: '#F59E0B' },
        ].map((s, i) => (
          <View key={i} style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all','active','completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No sessions yet this shift</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.sessionId}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          renderItem={({ item: s }) => (
            <View style={[styles.card, s.status === 'active' && styles.cardActive]}>
              <View style={styles.cardRow}>
                <Text style={styles.vehicleIcon}>{VEHICLE_ICONS[s.vehicleType] || '🚗'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.tokenText}>{s.tokenNumber}</Text>
                    <View style={[styles.statusChip,
                      { backgroundColor: s.status === 'active'
                        ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)' }
                    ]}>
                      <Text style={[styles.statusChipText,
                        { color: s.status === 'active' ? '#10B981' : '#3B82F6' }
                      ]}>
                        {s.status === 'active' ? '🟢 Active' : '✅ Done'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.plateLine}>{s.plateNumber}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaItem}>🕐 {fmtTime(s.entryTime)}</Text>
                    {s.slotId && <Text style={styles.metaItem}>📍 {s.slotId}</Text>}
                    {s.status === 'completed' && (
                      <>
                        <Text style={styles.metaItem}>⏱ {fmtDur(s.entryTime, s.exitTime)}</Text>
                        <Text style={[styles.metaItem, { color: '#10B981' }]}>
                          ₹{s.chargeAmount} · {s.paymentMethod}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0A0E1A' },

  summaryRow:   { flexDirection: 'row', backgroundColor: '#0E1420',
                  borderBottomWidth: 1, borderBottomColor: '#1E2D45' },
  summaryCell:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryValue: { fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
  summaryLabel: { fontSize: 10, color: '#5A7090', marginTop: 2 },

  filterRow:        { flexDirection: 'row', padding: 12, gap: 8 },
  filterTab:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8,
                      backgroundColor: '#131B2A', borderWidth: 1, borderColor: '#1E2D45' },
  filterTabActive:  { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' },
  filterTabText:    { fontSize: 12, fontWeight: '700', color: '#5A7090' },
  filterTabTextActive: { color: '#F59E0B' },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#5A7090' },

  card:       { backgroundColor: '#131B2A', borderRadius: 14, borderWidth: 1,
                borderColor: '#1E2D45', padding: 14, marginBottom: 10 },
  cardActive: { borderColor: 'rgba(16,185,129,0.4)' },
  cardRow:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  vehicleIcon:{ fontSize: 28, marginTop: 2 },

  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  tokenText:  { fontSize: 16, fontWeight: '800', color: '#F0F4FF', fontFamily: 'monospace' },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusChipText: { fontSize: 10, fontWeight: '700' },

  plateLine:  { fontSize: 12, color: '#5A7090', marginBottom: 6, fontFamily: 'monospace' },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem:   { fontSize: 11, color: '#7A90A8' },
});
