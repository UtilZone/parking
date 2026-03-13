/**
 * OwnerDashboardPage — Owner Web App
 * Multi-lot: owner can switch between locations.
 * Live Firestore: revenue, active count, anomalies.
 */

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  orderBy, limit, Timestamp, getDocs,
} from 'firebase/firestore';
import { firestore } from '../config/firebase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lot {
  lotId:        string;
  name:         string;
  city:         string;
  parkingMode:  'slot_based' | 'capacity_based';
  totalCapacity?:number;
  currentCount?: number;
  totalSlots?:   number;
  isActive:     boolean;
  revenue?:     { today: number; month: number; total: number };
}

interface Session {
  sessionId:    string;
  tokenNumber:  string;
  plateNumber:  string;
  vehicleType:  string;
  slotId?:      string;
  parkingMode:  string;
  entryTime:    Timestamp;
}

interface Txn {
  txnId:     string;
  amount:    number;
  method:    string;
  timestamp: Timestamp;
}

interface Anomaly {
  anomalyId:   string;
  type:        string;
  severity:    string;
  description: string;
  createdAt:   Timestamp;
}

interface Props { tenantId: string; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerDashboardPage({ tenantId }: Props) {
  const [lots,           setLots]           = useState<Lot[]>([]);
  const [selectedLotId,  setSelectedLotId]  = useState<string>('all');
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [recentTxns,     setRecentTxns]     = useState<Txn[]>([]);
  const [anomalies,      setAnomalies]      = useState<Anomaly[]>([]);
  const [hourlyData,     setHourlyData]     = useState<{ hour: string; amount: number }[]>([]);
  const [todayRevenue,   setTodayRevenue]   = useState(0);

  // ── Load all lots ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(firestore, 'tenants', tenantId, 'parkingLots'),
      where('isActive', '==', true)
    );
    return onSnapshot(q, snap => {
      setLots(snap.docs.map(d => ({ ...d.data(), lotId: d.id }) as Lot));
    });
  }, [tenantId]);

  // ── Live active sessions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    let q = query(
      collection(firestore, 'tenants', tenantId, 'sessions'),
      where('status', '==', 'active'),
      orderBy('entryTime', 'desc'),
      limit(30)
    );
    if (selectedLotId !== 'all') {
      q = query(
        collection(firestore, 'tenants', tenantId, 'sessions'),
        where('status', '==', 'active'),
        where('lotId', '==', selectedLotId),
        orderBy('entryTime', 'desc'),
        limit(30)
      );
    }
    return onSnapshot(q, snap => {
      setActiveSessions(snap.docs.map(d => ({ ...d.data(), sessionId: d.id }) as Session));
    });
  }, [tenantId, selectedLotId]);

  // ── Today's transactions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);

    let q = query(
      collection(firestore, 'tenants', tenantId, 'transactions'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    if (selectedLotId !== 'all') {
      q = query(
        collection(firestore, 'tenants', tenantId, 'transactions'),
        where('lotId', '==', selectedLotId),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
    }
    return onSnapshot(q, snap => {
      const txns  = snap.docs.map(d => d.data() as Txn);
      const total = txns.reduce((s, t) => s + (t.amount ?? 0), 0);
      setTodayRevenue(total);
      setRecentTxns(txns.slice(0, 10));

      // Hourly buckets
      const buckets: Record<string, number> = {};
      for (let i = 7; i >= 0; i--) {
        const d = new Date(); d.setHours(d.getHours() - i, 0, 0, 0);
        buckets[`${d.getHours()}:00`] = 0;
      }
      txns.forEach(t => {
        const h = `${(t.timestamp as Timestamp).toDate().getHours()}:00`;
        if (h in buckets) buckets[h] += t.amount ?? 0;
      });
      setHourlyData(Object.entries(buckets).map(([hour, amount]) => ({ hour, amount })));
    });
  }, [tenantId, selectedLotId]);

  // ── Anomalies ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    let q = query(
      collection(firestore, 'tenants', tenantId, 'anomalies'),
      where('isResolved', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    if (selectedLotId !== 'all') {
      q = query(
        collection(firestore, 'tenants', tenantId, 'anomalies'),
        where('lotId', '==', selectedLotId),
        where('isResolved', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    }
    return onSnapshot(q, snap => {
      setAnomalies(snap.docs.map(d => d.data() as Anomaly));
    });
  }, [tenantId, selectedLotId]);

  // ── Derived: capacity summary for selected lot ────────────────────────────
  const selectedLot = lots.find(l => l.lotId === selectedLotId);
  const totalVehicles = selectedLotId === 'all'
    ? activeSessions.length
    : activeSessions.length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={css.page}>

      {/* ── Location switcher ─────────────────────────────────────────── */}
      <div style={css.locBar}>
        <div style={css.locLabel}>LOCATION</div>
        <div style={css.locTabs}>
          <button
            style={{ ...css.locTab, ...(selectedLotId === 'all' ? css.locTabActive : {}) }}
            onClick={() => setSelectedLotId('all')}
          >
            🏢 All Locations
          </button>
          {lots.map(lot => (
            <button
              key={lot.lotId}
              style={{ ...css.locTab, ...(selectedLotId === lot.lotId ? css.locTabActive : {}) }}
              onClick={() => setSelectedLotId(lot.lotId)}
            >
              {lot.parkingMode === 'slot_based' ? '🔢' : '📊'} {lot.name}
              <span style={css.cityTag}>{lot.city}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────── */}
      <div style={css.statsGrid}>
        {[
          { label: 'Revenue Today',    value: `₹${todayRevenue.toLocaleString('en-IN')}`, color: '#F59E0B', icon: '💰' },
          { label: 'Active Vehicles',  value: String(totalVehicles),                       color: '#10B981', icon: '🚗' },
          { label: 'Anomalies',        value: String(anomalies.length),                    color: anomalies.length > 0 ? '#EF4444' : '#10B981', icon: '⚠️' },
          { label: 'Locations',        value: String(lots.length),                         color: '#3B82F6', icon: '📍' },
        ].map((s, i) => (
          <div key={i} style={{ ...css.statCard, borderTop: `3px solid ${s.color}` }}>
            <div style={css.statIcon}>{s.icon}</div>
            <div style={{ ...css.statValue, color: s.color }}>{s.value}</div>
            <div style={css.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Capacity bar (capacity_based lot selected) ────────────────── */}
      {selectedLot?.parkingMode === 'capacity_based' && (
        <div style={css.capacityRow}>
          <div style={css.capacityInfo}>
            <span style={css.capacityTitle}>{selectedLot.name} — Capacity</span>
            <span style={css.capacityNumbers}>
              {selectedLot.currentCount ?? 0} / {selectedLot.totalCapacity ?? '?'}
            </span>
          </div>
          <div style={css.capBar}>
            <div style={{
              ...css.capFill,
              width: `${Math.min(100, ((selectedLot.currentCount ?? 0) / (selectedLot.totalCapacity ?? 1)) * 100)}%`,
              background: (selectedLot.currentCount ?? 0) >= (selectedLot.totalCapacity ?? 0) ? '#EF4444' : '#10B981',
            }} />
          </div>
        </div>
      )}

      <div style={css.grid2}>
        {/* ── Revenue chart ──────────────────────────────────────────── */}
        <div style={css.card}>
          <div style={css.cardTitle}>Revenue — Last 8 Hours</div>
          <div style={{ height: 160, width: "100%", overflow: "hidden" }}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis dataKey="hour" tick={{ fill: '#5A7090', fontSize: 10 }} />
              <YAxis tick={{ fill: '#5A7090', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 8 }}
                formatter={(v: number) => [`₹${v}`, 'Revenue']}
              />
              <Bar dataKey="amount" fill="#F59E0B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* ── Anomalies ──────────────────────────────────────────────── */}
        <div style={css.card}>
          <div style={css.cardTitle}>
            Anomalies
            {anomalies.length > 0 &&
              <span style={css.badge}>{anomalies.length}</span>
            }
          </div>
          {anomalies.length === 0
            ? <div style={css.emptyState}>✅ No anomalies detected</div>
            : anomalies.map(a => (
              <div key={a.anomalyId} style={{ ...css.anomalyItem,
                borderLeft: `3px solid ${a.severity === 'high' ? '#EF4444' : a.severity === 'medium' ? '#F59E0B' : '#3B82F6'}` }}>
                <div style={css.anomalyType}>{a.type.replace(/_/g,' ').toUpperCase()}</div>
                <div style={css.anomalyDesc}>{a.description}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Active vehicles ────────────────────────────────────────────── */}
      <div style={css.card}>
        <div style={css.cardTitle}>Active Vehicles ({activeSessions.length})</div>
        <table style={css.table}>
          <thead>
            <tr>{['Token','Plate','Lot','Type','Slot/Mode','Since'].map(h =>
              <th key={h} style={css.th}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {activeSessions.map(s => {
              const mins = Math.floor((Date.now() - s.entryTime.toMillis()) / 60000);
              const dur  = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
              const lot  = lots.find(l => l.lotId === (s as any).lotId);
              return (
                <tr key={s.sessionId} style={css.tr}>
                  <td style={css.tdMono}>{s.tokenNumber}</td>
                  <td style={css.tdMono}>{s.plateNumber}</td>
                  <td style={css.td}>{lot?.name || '—'}</td>
                  <td style={{ ...css.td, textTransform: 'capitalize' }}>{s.vehicleType}</td>
                  <td style={{ ...css.td, color: '#3B82F6' }}>
                    {s.parkingMode === 'slot_based' ? s.slotId || '—' : '📊 Open'}
                  </td>
                  <td style={{ ...css.td, color: mins > 240 ? '#EF4444' : '#10B981' }}>{dur}</td>
                </tr>
              );
            })}
            {activeSessions.length === 0 &&
              <tr><td colSpan={6} style={{ ...css.td, textAlign:'center', color:'#5A7090', padding:24 }}>No active vehicles</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css: Record<string, React.CSSProperties> = {
  page:      { padding: 24, background: '#0A0E1A',
               fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' },

  locBar:    { marginBottom: 24 },
  locLabel:  { fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#5A7090', marginBottom: 10 },
  locTabs:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  locTab:    { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 10,
               padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#5A7090',
               cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  locTabActive: { borderColor: '#F59E0B', color: '#F59E0B', background: 'rgba(245,158,11,0.08)' },
  cityTag:   { background: 'rgba(255,255,255,0.05)', borderRadius: 4,
               padding: '1px 6px', fontSize: 10, color: '#5A7090' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard:  { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 18 },
  statIcon:  { fontSize: 20, marginBottom: 10 },
  statValue: { fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 4, fontFamily: 'monospace' },
  statLabel: { fontSize: 11, color: '#5A7090' },

  capacityRow: { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 12,
                 padding: 16, marginBottom: 16 },
  capacityInfo:{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  capacityTitle:{ fontSize: 13, fontWeight: 700 },
  capacityNumbers:{ fontSize: 13, fontFamily: 'monospace', color: '#10B981' },
  capBar:    { height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' },
  capFill:   { height: '100%', borderRadius: 999, transition: 'width 0.5s' },

  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card:      { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14,
               padding: 20, marginBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: 700, marginBottom: 14,
               display: 'flex', alignItems: 'center', gap: 8 },
  badge:     { background: '#EF4444', color: 'white', borderRadius: 999,
               fontSize: 10, fontWeight: 700, padding: '2px 7px' },
  emptyState:{ color: '#10B981', fontSize: 13, padding: '16px 0' },
  anomalyItem: { padding: '12px 14px', marginBottom: 8,
                 background: 'rgba(255,255,255,0.02)', borderRadius: 10 },
  anomalyType: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 },
  anomalyDesc: { fontSize: 12, color: '#7A90A8', lineHeight: 1.6 },

  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#5A7090',
            textTransform: 'uppercase', padding: '8px 10px', textAlign: 'left',
            borderBottom: '1px solid #1E2D45' },
  tr:     { borderBottom: '1px solid rgba(30,45,69,0.5)' },
  td:     { fontSize: 12, color: '#F0F4FF', padding: '10px 10px' },
  tdMono: { fontSize: 12, color: '#F0F4FF', padding: '10px', fontFamily: 'monospace', fontWeight: 600 },
};
