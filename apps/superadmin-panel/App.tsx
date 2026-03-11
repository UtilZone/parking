/**
 * ParkSmart Super Admin Panel — Root App
 * utilzone internal tool. Email + password login, superadmin role enforced.
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, User,
} from 'firebase/auth';
import { auth } from './src/config/firebase';
import SuperAdminDashboard from './src/pages/SuperAdminDashboard';
import TenantDetailPage    from './src/pages/TenantDetailPage';
import BillingPage         from './src/pages/BillingPage';

const NAV = [
  { to: '/',       icon: '📊', label: 'Dashboard'  },
  { to: '/billing',icon: '💳', label: 'Billing'    },
];

// ── Login page ────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const cred  = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult();
      if (token.claims['role'] !== 'superadmin') {
        await signOut(auth);
        setError('Access denied — SuperAdmin accounts only.');
        return;
      }
      onLogin();
    } catch (err: any) {
      setError(err.code === 'auth/wrong-password' ? 'Incorrect password.'
             : err.code === 'auth/user-not-found' ? 'Account not found.'
             : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#0E1420',
        border: '1px solid #1E2D45', borderRadius: 20, padding: 32 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 28, color: '#F59E0B' }}>⬡</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F0F4FF' }}>ParkSmart</div>
            <div style={{ fontSize: 9, color: '#5A7090', letterSpacing: 1.5 }}>SUPER ADMIN · UTILZONE</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          {[
            { label: 'EMAIL',    type: 'email',    val: email,    set: setEmail },
            { label: 'PASSWORD', type: 'password', val: password, set: setPassword },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                color: '#5A7090', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</label>
              <input style={{ width: '100%', boxSizing: 'border-box', background: '#080C14',
                border: '1px solid #1E2D45', borderRadius: 10, padding: '11px 13px',
                fontSize: 13, color: '#F0F4FF', outline: 'none', fontFamily: 'inherit' }}
                type={f.type} value={f.val} onChange={e => f.set(e.target.value)} required />
            </div>
          ))}
          {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#EF4444', marginBottom: 14 }}>
            {error}
          </div>}
          <button style={{ width: '100%', background: '#F59E0B', border: 'none', borderRadius: 10,
            padding: 13, fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer' }}
            type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In as Admin →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult();
        if (token.claims['role'] === 'superadmin') {
          setUser(u); setIsSuperAdmin(true);
        } else {
          await signOut(auth); setUser(null);
        }
      } else {
        setUser(null); setIsSuperAdmin(false);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#080C14', color: '#F59E0B',
        fontSize: 16, fontWeight: 700, fontFamily: 'system-ui' }}>
        ⬡ Loading ParkSmart Admin…
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <AdminLogin onLogin={() => {}} />;
  }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: '#080C14',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 220, background: '#0E1420', borderRight: '1px solid #1E2D45',
          display: 'flex', flexDirection: 'column', padding: '24px 14px', gap: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28, paddingLeft: 4 }}>
            <span style={{ fontSize: 24, color: '#F59E0B' }}>⬡</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#F0F4FF' }}>ParkSmart</div>
              <div style={{ fontSize: 8, color: '#EF4444', letterSpacing: 2, textTransform: 'uppercase' }}>
                Super Admin
              </div>
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  color: isActive ? '#F59E0B' : '#5A7090', textDecoration: 'none',
                  background: isActive ? 'rgba(245,158,11,0.1)' : 'none', marginBottom: 2,
                })}>
                <span>{n.icon}</span><span>{n.label}</span>
              </NavLink>
            ))}
          </nav>

          <div style={{ borderTop: '1px solid #1E2D45', paddingTop: 12, fontSize: 11, color: '#3A506B' }}>
            {user.email}
          </div>
          <button style={{ background: 'none', border: '1px solid #1E2D45', color: '#5A7090',
            borderRadius: 8, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            onClick={() => signOut(auth)}>Sign Out</button>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#080C14' }}>
          <Routes>
            <Route path="/"           element={<SuperAdminDashboard />} />
            <Route path="/tenant/:id" element={<TenantDetailPage />} />
            <Route path="/billing"    element={<BillingPage />} />
            <Route path="*"           element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
