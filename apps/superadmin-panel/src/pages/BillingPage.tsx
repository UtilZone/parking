/**
 * BillingPage — SuperAdmin Panel
 * View all tenants grouped by plan, manage subscriptions, update plan pricing config.
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../config/firebase';

interface Tenant {
  tenantId:          string;
  businessName:      string;
  ownerName:         string;
  ownerPhone:        string;
  plan:              string;
  status:            string;
  subscriptionStart: any;
  subscriptionEnd:   any;
}

const PLANS = [
  { id: 'trial',      label: 'Free Trial',  price: '₹0',      color: '#5A7090' },
  { id: 'basic',      label: 'Basic',       price: '₹999/mo', color: '#3B82F6' },
  { id: 'pro',        label: 'Pro',         price: '₹2,499/mo',color: '#F59E0B' },
  { id: 'enterprise', label: 'Enterprise',  price: 'Custom',   color: '#A78BFA' },
];

export default function BillingPage() {
  const [tenants,     setTenants]     = useState<Tenant[]>([]);
  const [activeOnly,  setActiveOnly]  = useState(true);
  const [selectedPlan,setSelectedPlan]= useState<string | null>(null);
  const [msg,         setMsg]         = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  useEffect(() => {
    let q = query(collection(firestore, 'tenants'));
    if (activeOnly) q = query(collection(firestore, 'tenants'), where('status', '==', 'active'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ ...d.data(), tenantId: d.id }) as Tenant));
    });
  }, [activeOnly]);

  const handleUpgrade = async (tenantId: string, plan: string) => {
    try {
      await httpsCallable(functions, 'approveTenant')({ tenantId, plan });
      flash(`✅ Plan updated to ${plan}.`);
    } catch (e: any) { flash(`❌ ${e.message}`); }
  };

  // Group tenants by plan
  const byPlan = PLANS.map(p => ({
    ...p, tenants: tenants.filter(t => t.plan === p.id),
  }));

  const totalMRR = tenants.filter(t => t.status === 'active').reduce((sum, t) => {
    const rates: Record<string, number> = { trial: 0, basic: 999, pro: 2499, enterprise: 0 };
    return sum + (rates[t.plan] || 0);
  }, 0);

  return (
    <div style={css.page}>
      <div style={css.header}>
        <h1 style={css.title}>Billing & Subscriptions</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={css.toggle}>
            <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
            <span style={{ marginLeft: 8, fontSize: 12, color: '#5A7090' }}>Active tenants only</span>
          </label>
        </div>
      </div>

      {msg && <div style={css.flash}>{msg}</div>}

      {/* MRR card */}
      <div style={css.mrrCard}>
        <div style={css.mrrLabel}>MONTHLY RECURRING REVENUE (MRR)</div>
        <div style={css.mrrValue}>₹{totalMRR.toLocaleString('en-IN')}</div>
        <div style={css.mrrSub}>{tenants.filter(t => t.status === 'active').length} active tenants</div>
      </div>

      {/* Plan breakdown */}
      <div style={css.plansGrid}>
        {byPlan.map(p => (
          <div key={p.id} style={{ ...css.planCard, borderTop: `3px solid ${p.color}` }}
            onClick={() => setSelectedPlan(selectedPlan === p.id ? null : p.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...css.planName, color: p.color }}>{p.label}</div>
                <div style={css.planPrice}>{p.price}</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.color }}>{p.tenants.length}</div>
            </div>
            <div style={css.planSub}>
              MRR: ₹{(p.tenants.filter(t => t.status === 'active').length *
                (['basic','pro','enterprise'].includes(p.id)
                  ? (p.id === 'basic' ? 999 : p.id === 'pro' ? 2499 : 0) : 0)
              ).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>

      {/* Tenant list for selected plan */}
      {selectedPlan && (
        <div style={css.card}>
          <div style={css.cardTitle}>
            {PLANS.find(p => p.id === selectedPlan)?.label} Tenants ({byPlan.find(p => p.id === selectedPlan)?.tenants.length})
          </div>
          <table style={css.table}>
            <thead>
              <tr>{['Business', 'Owner', 'Phone', 'Status', 'Sub Start', 'Sub End', 'Change Plan'].map(h =>
                <th key={h} style={css.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {byPlan.find(p => p.id === selectedPlan)?.tenants.map(t => (
                <tr key={t.tenantId} style={css.tr}>
                  <td style={css.tdBold}>{t.businessName}</td>
                  <td style={css.td}>{t.ownerName}</td>
                  <td style={{ ...css.td, fontFamily: 'monospace' }}>{t.ownerPhone}</td>
                  <td style={css.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700,
                      background: t.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                      color: t.status === 'active' ? '#10B981' : '#EF4444' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ ...css.td, color: '#5A7090' }}>
                    {t.subscriptionStart?.toDate?.()?.toLocaleDateString('en-IN') || '—'}
                  </td>
                  <td style={{ ...css.td, color: '#5A7090' }}>
                    {t.subscriptionEnd?.toDate?.()?.toLocaleDateString('en-IN') || '—'}
                  </td>
                  <td style={css.td}>
                    <select style={css.planSelect}
                      value={t.plan}
                      onChange={e => handleUpgrade(t.tenantId, e.target.value)}>
                      {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  page:      { padding: 28, minHeight: '100vh', background: '#080C14', color: '#F0F4FF',
               fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:     { fontSize: 22, fontWeight: 800, margin: 0 },
  flash:     { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
               borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#10B981' },
  toggle:    { display: 'flex', alignItems: 'center', cursor: 'pointer' },
  mrrCard:   { background: 'linear-gradient(135deg, #131B2A 0%, #0E1420 100%)',
               border: '1px solid #1E2D45', borderRadius: 16, padding: '28px 32px',
               marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 4 },
  mrrLabel:  { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#5A7090' },
  mrrValue:  { fontSize: 42, fontWeight: 900, color: '#F59E0B', fontFamily: 'monospace', lineHeight: 1 },
  mrrSub:    { fontSize: 13, color: '#5A7090' },
  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  planCard:  { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 18,
               cursor: 'pointer', transition: 'border-color 0.2s' },
  planName:  { fontSize: 13, fontWeight: 800, marginBottom: 2 },
  planPrice: { fontSize: 11, color: '#5A7090' },
  planSub:   { fontSize: 10, color: '#3A506B', marginTop: 8 },
  card:      { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20 },
  cardTitle: { fontSize: 13, fontWeight: 700, marginBottom: 14 },
  table:     { width: '100%', borderCollapse: 'collapse' as const },
  th:        { fontSize: 9, fontWeight: 700, color: '#5A7090', letterSpacing: 1, textTransform: 'uppercase' as const,
               padding: '8px 12px', textAlign: 'left' as const, borderBottom: '1px solid #1E2D45' },
  tr:        { borderBottom: '1px solid rgba(30,45,69,0.5)' },
  td:        { fontSize: 12, padding: '10px 12px', color: '#F0F4FF' },
  tdBold:    { fontSize: 13, fontWeight: 700, padding: '10px 12px', color: '#F0F4FF' },
  planSelect:{ background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 7,
               padding: '4px 8px', fontSize: 11, color: '#F59E0B', cursor: 'pointer', outline: 'none' },
};
