/**
 * SuperAdminDashboard — utilzone platform panel
 * Approve/suspend tenants, platform stats, announcements, billing management.
 */

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  where, doc, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type TenantStatus = 'pending_approval' | 'active' | 'suspended' | 'cancelled';

interface Tenant {
  tenantId:         string;
  businessName:     string;
  ownerName:        string;
  ownerPhone:       string;
  ownerEmail:       string;
  status:           TenantStatus;
  plan:             string;
  totalLots:        number;
  createdAt:        Timestamp;
  registrationNote: string;
  approvedAt?:      Timestamp;
}

interface PlatformStats {
  totalTenants:   number;
  activeTenants:  number;
  pendingTenants: number;
  suspended:      number;
  byPlan:         Record<string, number>;
  totalOwners:    number;
}

type TabKey = 'overview' | 'pending' | 'tenants' | 'announce';

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const [activeTab,    setActiveTab]    = useState<TabKey>('overview');
  const [tenants,      setTenants]      = useState<Tenant[]>([]);
  const [stats,        setStats]        = useState<PlatformStats | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [actionMsg,    setActionMsg]    = useState('');
  const [announceForm, setAnnounceForm] = useState({ title: '', body: '', targetRoles: ['owner', 'attendant'] });

  // Live tenant list
  useEffect(() => {
    const q = query(collection(firestore, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ ...d.data(), tenantId: d.id }) as Tenant));
    });
  }, []);

  // Load platform stats
  useEffect(() => {
    if (activeTab !== 'overview') return;
    setIsLoading(true);
    const fn = httpsCallable<object, PlatformStats>(functions, 'getPlatformStats');
    fn({}).then(r => setStats(r.data)).finally(() => setIsLoading(false));
  }, [activeTab]);

  const pending  = tenants.filter(t => t.status === 'pending_approval');
  const active   = tenants.filter(t => t.status === 'active');
  const suspended = tenants.filter(t => t.status === 'suspended');

  // ── Actions ─────────────────────────────────────────────────────────────

  const approveTenant = async (tenantId: string, plan = 'basic') => {
    setIsLoading(true);
    try {
      await httpsCallable(functions, 'approveTenant')({ tenantId, plan });
      setActionMsg(`✅ Tenant approved`);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const suspendTenant = async (tenantId: string) => {
    const reason = window.prompt('Reason for suspension:');
    if (!reason) return;
    setIsLoading(true);
    try {
      await httpsCallable(functions, 'suspendTenant')({ tenantId, reason });
      setActionMsg(`✅ Tenant suspended`);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const sendAnnouncement = async () => {
    if (!announceForm.title || !announceForm.body) return;
    setIsLoading(true);
    try {
      await httpsCallable(functions, 'pushAnnouncement')({
        ...announceForm, isPinned: false,
      });
      setActionMsg('✅ Announcement sent to all users');
      setAnnounceForm({ title: '', body: '', targetRoles: ['owner', 'attendant'] });
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  // ── Status chip colours ────────────────────────────────────────────────

  const statusColor = (s: TenantStatus) => ({
    pending_approval: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    active:           { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
    suspended:        { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444' },
    cancelled:        { bg: 'rgba(90,112,144,0.15)', color: '#5A7090' },
  })[s];

  const planColor = (p: string) => ({
    trial: '#5A7090', basic: '#3B82F6', pro: '#F59E0B', enterprise: '#A78BFA',
  })[p] || '#5A7090';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={css.shell}>
      {/* Sidebar */}
      <aside style={css.sidebar}>
        <div style={css.brand}>
          <div style={css.brandIcon}>⬡</div>
          <div>
            <div style={css.brandName}>ParkSmart</div>
            <div style={css.brandSub}>Super Admin</div>
          </div>
        </div>
        {([
          ['overview', '📊', 'Overview'],
          ['pending',  '⏳', `Pending (${pending.length})`],
          ['tenants',  '🏢', 'All Tenants'],
          ['announce', '📣', 'Announcements'],
        ] as [TabKey, string, string][]).map(([key, icon, label]) => (
          <button key={key} style={{ ...css.navBtn, ...(activeTab === key ? css.navBtnActive : {}) }}
            onClick={() => setActiveTab(key)}>
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main style={css.main}>
        {actionMsg && <div style={css.actionMsg}>{actionMsg}</div>}

        {/* ── Overview ──────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <h1 style={css.pageTitle}>Platform Overview</h1>
            {stats ? (
              <>
                <div style={css.statsGrid}>
                  {[
                    { label: 'Total Tenants',  value: stats.totalTenants,   color: '#F0F4FF', icon: '🏢' },
                    { label: 'Active',         value: stats.activeTenants,  color: '#10B981', icon: '✅' },
                    { label: 'Pending',        value: stats.pendingTenants, color: '#F59E0B', icon: '⏳' },
                    { label: 'Suspended',      value: stats.suspended,      color: '#EF4444', icon: '🚫' },
                  ].map((s, i) => (
                    <div key={i} style={css.statCard}>
                      <div style={css.statIcon}>{s.icon}</div>
                      <div style={{ ...css.statValue, color: s.color }}>{s.value}</div>
                      <div style={css.statLabel}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={css.card}>
                  <div style={css.cardTitle}>Tenants by Plan</div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {Object.entries(stats.byPlan).map(([plan, count]) => (
                      <div key={plan} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: planColor(plan) }}>{count}</div>
                        <div style={{ fontSize: 11, color: '#5A7090', textTransform: 'capitalize' }}>{plan}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <div style={css.loading}>Loading platform stats…</div>}
          </div>
        )}

        {/* ── Pending Approvals ─────────────────────────────────────── */}
        {activeTab === 'pending' && (
          <div>
            <h1 style={css.pageTitle}>Pending Approvals ({pending.length})</h1>
            {pending.length === 0 ? (
              <div style={css.emptyState}>✅ No pending approvals</div>
            ) : (
              pending.map(t => (
                <div key={t.tenantId} style={css.tenantCard}>
                  <div style={css.tenantHeader}>
                    <div>
                      <div style={css.tenantName}>{t.businessName}</div>
                      <div style={css.tenantMeta}>{t.ownerName} · {t.ownerPhone} · {t.ownerEmail}</div>
                      {t.registrationNote && (
                        <div style={css.regNote}>"{t.registrationNote}"</div>
                      )}
                    </div>
                    <div style={css.tenantActions}>
                      {(['trial','basic','pro'] as const).map(plan => (
                        <button key={plan} style={{ ...css.approveBtn, background: planColor(plan) + '20',
                          color: planColor(plan), borderColor: planColor(plan) + '40' }}
                          onClick={() => approveTenant(t.tenantId, plan)}
                        >
                          Approve as {plan}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={css.tenantFooter}>
                    <span style={css.timeLabel}>
                      Registered {t.createdAt.toDate().toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── All Tenants ───────────────────────────────────────────── */}
        {activeTab === 'tenants' && (
          <div>
            <h1 style={css.pageTitle}>All Tenants ({tenants.length})</h1>
            <table style={css.table}>
              <thead>
                <tr>{['Business','Owner','Phone','Plan','Status','Lots','Registered','Actions']
                  .map(h => <th key={h} style={css.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tenants.map(t => {
                  const sc = statusColor(t.status);
                  return (
                    <tr key={t.tenantId} style={css.tr}>
                      <td style={css.tdBold}>{t.businessName}</td>
                      <td style={css.td}>{t.ownerName}</td>
                      <td style={{ ...css.td, fontFamily: 'monospace' }}>{t.ownerPhone}</td>
                      <td style={{ ...css.td, color: planColor(t.plan), fontWeight: 700, textTransform: 'capitalize' }}>{t.plan}</td>
                      <td style={css.td}>
                        <span style={{ ...css.chip, background: sc.bg, color: sc.color }}>
                          {t.status.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={css.td}>{t.totalLots}</td>
                      <td style={{ ...css.td, color: '#5A7090' }}>
                        {t.createdAt.toDate().toLocaleDateString('en-IN')}
                      </td>
                      <td style={css.td}>
                        {t.status === 'pending_approval' && (
                          <button style={css.smallBtn} onClick={() => approveTenant(t.tenantId)}>
                            Approve
                          </button>
                        )}
                        {t.status === 'active' && (
                          <button style={{ ...css.smallBtn, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                            onClick={() => suspendTenant(t.tenantId)}>
                            Suspend
                          </button>
                        )}
                        {t.status === 'suspended' && (
                          <button style={css.smallBtn} onClick={() => approveTenant(t.tenantId)}>
                            Reinstate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Announcements ─────────────────────────────────────────── */}
        {activeTab === 'announce' && (
          <div>
            <h1 style={css.pageTitle}>Push Announcement</h1>
            <div style={css.card}>
              <div style={css.formRow}>
                <label style={css.formLabel}>TITLE</label>
                <input
                  style={css.formInput}
                  value={announceForm.title}
                  onChange={e => setAnnounceForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Scheduled Maintenance — 2 AM IST"
                />
              </div>
              <div style={css.formRow}>
                <label style={css.formLabel}>MESSAGE</label>
                <textarea
                  style={{ ...css.formInput, height: 100, resize: 'vertical' }}
                  value={announceForm.body}
                  onChange={e => setAnnounceForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Full announcement text…"
                />
              </div>
              <div style={css.formRow}>
                <label style={css.formLabel}>TARGET ROLES</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['owner','attendant','customer'] as const).map(r => (
                    <button key={r} style={{
                      ...css.roleToggle,
                      ...(announceForm.targetRoles.includes(r) ? css.roleToggleActive : {}),
                    }}
                      onClick={() => setAnnounceForm(f => ({
                        ...f, targetRoles: f.targetRoles.includes(r)
                          ? f.targetRoles.filter(x => x !== r)
                          : [...f.targetRoles, r]
                      }))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <button style={css.sendBtn} onClick={sendAnnouncement} disabled={isLoading}>
                {isLoading ? 'Sending…' : '📣 Send to All Users'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css: Record<string, React.CSSProperties> = {
  shell:     { display: 'flex', minHeight: '100vh', background: '#080C14',
               fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' },

  sidebar:   { width: 220, background: '#0E1420', borderRight: '1px solid #1E2D45',
               padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  brand:     { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 32 },
  brandIcon: { fontSize: 28 },
  brandName: { fontSize: 15, fontWeight: 800 },
  brandSub:  { fontSize: 10, color: '#5A7090', letterSpacing: 1 },
  navBtn:    { background: 'none', border: 'none', color: '#5A7090', cursor: 'pointer',
               padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
               display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left' },
  navBtnActive: { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' },

  main:      { flex: 1, padding: 32, overflowY: 'auto' },
  pageTitle: { fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: -0.5 },

  actionMsg: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
               borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13,
               color: '#10B981' },
  loading:   { color: '#5A7090', fontSize: 14, padding: 24 },
  emptyState:{ color: '#10B981', fontSize: 14, padding: 24 },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard:  { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20 },
  statIcon:  { fontSize: 22, marginBottom: 10 },
  statValue: { fontSize: 30, fontWeight: 800, lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#5A7090' },

  card:      { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 22, marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, marginBottom: 14 },

  tenantCard:   { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20, marginBottom: 12 },
  tenantHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tenantName:   { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  tenantMeta:   { fontSize: 12, color: '#5A7090' },
  regNote:      { fontSize: 12, color: '#7A90A8', fontStyle: 'italic', marginTop: 6 },
  tenantActions:{ display: 'flex', gap: 8 },
  tenantFooter: { borderTop: '1px solid #1E2D45', paddingTop: 10 },
  timeLabel:    { fontSize: 11, color: '#5A7090' },
  approveBtn:   { padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid' },
  smallBtn:     { padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', background: 'rgba(16,185,129,0.15)',
                  color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' },

  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#5A7090',
           textTransform: 'uppercase', padding: '8px 12px', textAlign: 'left',
           borderBottom: '1px solid #1E2D45' },
  tr:    { borderBottom: '1px solid rgba(30,45,69,0.5)' },
  td:    { fontSize: 12, color: '#F0F4FF', padding: '11px 12px' },
  tdBold:{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', padding: '11px 12px' },
  chip:  { padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 },

  formRow:    { marginBottom: 18 },
  formLabel:  { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#5A7090',
                display: 'block', marginBottom: 8 },
  formInput:  { width: '100%', background: '#0E1420', border: '1px solid #1E2D45',
                borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#F0F4FF',
                outline: 'none', fontFamily: 'inherit' },
  roleToggle: { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
                color: '#5A7090', border: '1px solid #1E2D45' },
  roleToggleActive: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                      borderColor: 'rgba(245,158,11,0.3)' },
  sendBtn:    { background: '#F59E0B', color: '#000', border: 'none', borderRadius: 10,
                padding: '13px 28px', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
};
