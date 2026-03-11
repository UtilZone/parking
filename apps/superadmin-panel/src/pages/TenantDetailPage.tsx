/**
 * TenantDetailPage — SuperAdmin Panel
 * Deep view: tenant info, lots, recent sessions, anomalies, plan change.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, query,
  orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../config/firebase';

interface Tenant {
  tenantId:         string;
  businessName:     string;
  ownerName:        string;
  ownerPhone:       string;
  ownerEmail:       string;
  status:           string;
  plan:             string;
  totalLots:        number;
  createdAt:        Timestamp;
  approvedAt?:      Timestamp;
  registrationNote: string;
  suspendedReason?: string;
}

interface Lot { lotId: string; name: string; parkingMode: string; currentCount: number; totalCapacity: number; revenue: any; }
interface Anomaly { anomalyId: string; type: string; severity: string; description: string; isResolved: boolean; createdAt: Timestamp; }

const PLANS = ['trial', 'basic', 'pro', 'enterprise'];

const PLAN_COLOR: Record<string, string> = {
  trial: '#5A7090', basic: '#3B82F6', pro: '#F59E0B', enterprise: '#A78BFA',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending_approval: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  active:           { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
  suspended:        { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444' },
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant,    setTenant]    = useState<Tenant | null>(null);
  const [lots,      setLots]      = useState<Lot[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [msg,       setMsg]       = useState('');
  const [newPlan,   setNewPlan]   = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const tenantDoc = await getDoc(doc(firestore, 'tenants', id));
      if (!tenantDoc.exists()) { navigate('/'); return; }
      const t = { ...tenantDoc.data(), tenantId: id } as Tenant;
      setTenant(t); setNewPlan(t.plan);

      const [lotsSnap, anomSnap] = await Promise.all([
        getDocs(collection(firestore, 'tenants', id, 'parkingLots')),
        getDocs(query(
          collection(firestore, 'tenants', id, 'anomalies'),
          orderBy('createdAt', 'desc'), limit(10)
        )),
      ]);

      setLots(lotsSnap.docs.map(d => ({ ...d.data(), lotId: d.id }) as Lot));
      setAnomalies(anomSnap.docs.map(d => d.data() as Anomaly));
      setIsLoading(false);
    };
    load();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await httpsCallable(functions, 'approveTenant')({ tenantId: id, plan: newPlan });
      setTenant(t => t ? { ...t, status: 'active', plan: newPlan } : t);
      flash('✅ Tenant approved successfully.');
    } catch (e: any) { flash(`❌ ${e.message}`); }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('Reason for suspension:');
    if (!reason || !id) return;
    try {
      await httpsCallable(functions, 'suspendTenant')({ tenantId: id, reason });
      setTenant(t => t ? { ...t, status: 'suspended', suspendedReason: reason } : t);
      flash('✅ Tenant suspended.');
    } catch (e: any) { flash(`❌ ${e.message}`); }
  };

  const handleChangePlan = async () => {
    if (!id || !tenant || newPlan === tenant.plan) return;
    try {
      await httpsCallable(functions, 'approveTenant')({ tenantId: id, plan: newPlan });
      setTenant(t => t ? { ...t, plan: newPlan } : t);
      flash(`✅ Plan changed to ${newPlan}.`);
    } catch (e: any) { flash(`❌ ${e.message}`); }
  };

  if (isLoading) return <div style={{ padding: 40, color: '#5A7090' }}>Loading tenant…</div>;
  if (!tenant)   return null;

  const sc = STATUS_COLOR[tenant.status] || { bg: '#131B2A', color: '#F0F4FF' };

  return (
    <div style={css.page}>
      <button style={css.backBtn} onClick={() => navigate('/')}>← Back to Dashboard</button>
      {msg && <div style={css.flash}>{msg}</div>}

      {/* Tenant header */}
      <div style={css.tenantHeader}>
        <div>
          <h1 style={css.tenantName}>{tenant.businessName}</h1>
          <div style={css.ownerInfo}>
            {tenant.ownerName} · {tenant.ownerPhone} · {tenant.ownerEmail}
          </div>
          {tenant.registrationNote && (
            <div style={css.regNote}>"{tenant.registrationNote}"</div>
          )}
          {tenant.suspendedReason && (
            <div style={{ ...css.regNote, color: '#EF4444' }}>
              Suspended: {tenant.suspendedReason}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <span style={{ ...css.chip, background: sc.bg, color: sc.color }}>
            {tenant.status.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span style={{ ...css.chip,
            background: PLAN_COLOR[tenant.plan] + '20',
            color: PLAN_COLOR[tenant.plan] }}>
            {tenant.plan.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Meta cards */}
      <div style={css.metaGrid}>
        {[
          { label: 'Registered',    value: tenant.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '—' },
          { label: 'Approved',      value: tenant.approvedAt?.toDate?.()?.toLocaleDateString('en-IN') || 'Not yet' },
          { label: 'Parking Lots',  value: String(lots.length) },
          { label: 'Tenant ID',     value: tenant.tenantId.slice(0, 16) + '…' },
        ].map((m, i) => (
          <div key={i} style={css.metaCard}>
            <div style={css.metaLabel}>{m.label}</div>
            <div style={css.metaValue}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={css.grid2}>
        {/* Actions */}
        <div style={css.card}>
          <div style={css.cardTitle}>Actions</div>
          {tenant.status === 'pending_approval' && (
            <div style={css.actionBlock}>
              <div style={css.actionLabel}>Approve with Plan</div>
              <select style={css.select} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button style={css.greenBtn} onClick={handleApprove}>✅ Approve Tenant</button>
            </div>
          )}
          {tenant.status === 'active' && (
            <>
              <div style={css.actionBlock}>
                <div style={css.actionLabel}>Change Plan</div>
                <select style={css.select} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button style={css.yellowBtn} onClick={handleChangePlan} disabled={newPlan === tenant.plan}>
                  Update Plan
                </button>
              </div>
              <div style={css.actionBlock}>
                <button style={css.redBtn} onClick={handleSuspend}>🚫 Suspend Account</button>
              </div>
            </>
          )}
          {tenant.status === 'suspended' && (
            <div style={css.actionBlock}>
              <div style={css.actionLabel}>Reinstate with Plan</div>
              <select style={css.select} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button style={css.greenBtn} onClick={handleApprove}>✅ Reinstate Account</button>
            </div>
          )}
        </div>

        {/* Anomalies */}
        <div style={css.card}>
          <div style={css.cardTitle}>Recent Anomalies ({anomalies.filter(a => !a.isResolved).length} unresolved)</div>
          {anomalies.length === 0
            ? <div style={css.empty}>✅ No anomalies on record</div>
            : anomalies.map(a => (
              <div key={a.anomalyId} style={{ ...css.anomalyRow,
                borderLeft: `3px solid ${a.severity === 'high' ? '#EF4444' : a.severity === 'medium' ? '#F59E0B' : '#3B82F6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
                    {a.type.replace(/_/g, ' ')}
                  </span>
                  {a.isResolved && <span style={{ fontSize: 9, color: '#10B981' }}>✅ resolved</span>}
                </div>
                <div style={{ fontSize: 11, color: '#7A90A8', lineHeight: 1.5 }}>{a.description}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Lots */}
      <div style={css.card}>
        <div style={css.cardTitle}>Parking Lots ({lots.length})</div>
        {lots.length === 0
          ? <div style={css.empty}>No lots created yet</div>
          : (
            <table style={css.table}>
              <thead><tr>
                {['Name', 'Mode', 'Occupancy', 'Revenue Today', 'Revenue Total'].map(h => (
                  <th key={h} style={css.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lots.map(l => (
                  <tr key={l.lotId} style={css.tr}>
                    <td style={css.tdBold}>{l.name}</td>
                    <td style={css.td}>
                      <span style={{ fontSize: 10, fontWeight: 700,
                        color: l.parkingMode === 'slot_based' ? '#3B82F6' : '#10B981' }}>
                        {l.parkingMode === 'slot_based' ? '🔢 Slot' : '📊 Capacity'}
                      </span>
                    </td>
                    <td style={css.td}>
                      {l.parkingMode === 'capacity_based'
                        ? `${l.currentCount ?? 0}/${l.totalCapacity}`
                        : '—'
                      }
                    </td>
                    <td style={{ ...css.td, color: '#F59E0B' }}>₹{l.revenue?.today ?? 0}</td>
                    <td style={{ ...css.td, color: '#10B981' }}>₹{l.revenue?.total ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  page:        { padding: 28, minHeight: '100vh', background: '#080C14', color: '#F0F4FF',
                 fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  backBtn:     { background: 'none', border: 'none', color: '#5A7090', fontSize: 13,
                 cursor: 'pointer', marginBottom: 20, padding: 0 },
  flash:       { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                 borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#10B981' },
  tenantHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  tenantName:  { fontSize: 24, fontWeight: 800, margin: '0 0 6px' },
  ownerInfo:   { fontSize: 13, color: '#5A7090' },
  regNote:     { fontSize: 12, color: '#7A90A8', fontStyle: 'italic', marginTop: 6 },
  chip:        { padding: '3px 10px', borderRadius: 999, fontSize: 9, fontWeight: 700 },
  metaGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 },
  metaCard:    { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 12, padding: 14 },
  metaLabel:   { fontSize: 9, fontWeight: 700, color: '#5A7090', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6 },
  metaValue:   { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card:        { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20, marginBottom: 4 },
  cardTitle:   { fontSize: 13, fontWeight: 700, marginBottom: 14 },
  empty:       { color: '#5A7090', fontSize: 13, padding: '12px 0' },
  actionBlock: { marginBottom: 14 },
  actionLabel: { fontSize: 9, fontWeight: 700, color: '#5A7090', letterSpacing: 1.5,
                 textTransform: 'uppercase' as const, marginBottom: 8 },
  select:      { width: '100%', background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 8,
                 padding: '8px 10px', fontSize: 12, color: '#F0F4FF', outline: 'none', marginBottom: 8 },
  greenBtn:    { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                 borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#10B981', cursor: 'pointer', width: '100%' },
  yellowBtn:   { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                 borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#F59E0B', cursor: 'pointer', width: '100%' },
  redBtn:      { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                 borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#EF4444', cursor: 'pointer', width: '100%' },
  anomalyRow:  { padding: '10px 12px', marginBottom: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 },
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  th:          { fontSize: 9, fontWeight: 700, color: '#5A7090', letterSpacing: 1, textTransform: 'uppercase' as const,
                 padding: '8px 12px', textAlign: 'left' as const, borderBottom: '1px solid #1E2D45' },
  tr:          { borderBottom: '1px solid rgba(30,45,69,0.5)' },
  td:          { fontSize: 12, padding: '10px 12px', color: '#F0F4FF' },
  tdBold:      { fontSize: 13, fontWeight: 700, padding: '10px 12px', color: '#F0F4FF' },
};
