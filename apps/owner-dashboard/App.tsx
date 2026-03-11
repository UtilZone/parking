/**
 * Owner Dashboard — React Web App
 * Routes: Overview | Lots | Attendants | Reports | Settings
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth }    from './src/config/firebase';
import { useOwnerAuth } from './src/hooks/useOwnerAuth';
import OwnerDashboardPage  from './src/pages/OwnerDashboardPage';
import LotsPage            from './src/pages/LotsPage';
import AttendantsPage      from './src/pages/AttendantsPage';
import ReportsPage         from './src/pages/ReportsPage';
import OwnerLoginPage      from './src/pages/OwnerLoginPage';

const NAV = [
  { to: '/',          icon: '📊', label: 'Overview'   },
  { to: '/lots',      icon: '🅿️', label: 'Locations'  },
  { to: '/attendants',icon: '👷', label: 'Attendants' },
  { to: '/reports',   icon: '📈', label: 'Reports'    },
];

const PLAN_COLOR: Record<string, string> = {
  trial: '#5A7090', basic: '#3B82F6', pro: '#F59E0B', enterprise: '#A78BFA',
};

export default function App() {
  const { user, isLoading } = useOwnerAuth();

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0A0E1A', color: '#F59E0B', fontSize: 18, fontWeight: 700 }}>
        Loading…
      </div>
    );
  }

  if (!user) return <OwnerLoginPage />;

  if (user.tenantStatus === 'pending_approval') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0A0E1A', color: '#F0F4FF', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Approval Pending</div>
        <div style={{ fontSize: 14, color: '#5A7090', maxWidth: 400 }}>
          Your account is pending review by ParkSmart admin. You'll receive a notification once approved.
        </div>
        <button style={{ marginTop: 16, background: 'none', border: '1px solid #1E2D45', color: '#5A7090',
          borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontSize: 13 }}
          onClick={() => signOut(auth)}>Sign Out</button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div style={css.shell}>
        {/* Sidebar */}
        <aside style={css.sidebar}>
          <div style={css.brand}>
            <span style={{ fontSize: 24, color: '#F59E0B' }}>⬡</span>
            <div>
              <div style={css.brandName}>ParkSmart</div>
              <div style={css.brandSub}>Owner Portal</div>
            </div>
          </div>

          {/* Tenant name */}
          <div style={css.tenantCard}>
            <div style={css.tenantName}>{user.tenantName}</div>
            <span style={{ ...css.planBadge, color: PLAN_COLOR[user.plan], background: PLAN_COLOR[user.plan] + '20' }}>
              {user.plan.toUpperCase()}
            </span>
          </div>

          {/* Nav links */}
          <nav style={{ flex: 1 }}>
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                style={({ isActive }) => ({
                  ...css.navLink,
                  ...(isActive ? css.navLinkActive : {}),
                })}>
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          <button style={css.signOutBtn} onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </aside>

        {/* Main content */}
        <main style={css.main}>
          <Routes>
            <Route path="/"           element={<OwnerDashboardPage tenantId={user.tenantId} />} />
            <Route path="/lots"       element={<LotsPage           tenantId={user.tenantId} />} />
            <Route path="/attendants" element={<AttendantsPage     tenantId={user.tenantId} />} />
            <Route path="/reports"    element={<ReportsPage        tenantId={user.tenantId} />} />
            <Route path="*"           element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const css: Record<string, React.CSSProperties> = {
  shell:   { display: 'flex', height: '100vh', background: '#0A0E1A',
             fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: 'hidden' },
  sidebar: { width: 228, background: '#0E1420', borderRight: '1px solid #1E2D45',
             display: 'flex', flexDirection: 'column', padding: '24px 14px', gap: 4,
             overflowY: 'auto' },
  brand:   { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, paddingLeft: 4 },
  brandName: { fontSize: 16, fontWeight: 900, color: '#F0F4FF' },
  brandSub:  { fontSize: 9, color: '#5A7090', letterSpacing: 1.5, textTransform: 'uppercase' },
  tenantCard:{ background: '#131B2A', borderRadius: 10, border: '1px solid #1E2D45',
               padding: '10px 12px', marginBottom: 16 },
  tenantName:{ fontSize: 13, fontWeight: 700, color: '#F0F4FF', marginBottom: 6,
               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  planBadge: { fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 },
  navLink:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
               borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#5A7090',
               textDecoration: 'none', marginBottom: 2, transition: 'all 0.15s' } as any,
  navLinkActive: { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
  signOutBtn:{ background: 'none', border: '1px solid #1E2D45', color: '#5A7090',
               borderRadius: 10, padding: '10px', cursor: 'pointer', fontSize: 12,
               fontWeight: 600, marginTop: 8 },
  main:    { flex: 1, overflowY: 'auto', background: '#0A0E1A' },
};
