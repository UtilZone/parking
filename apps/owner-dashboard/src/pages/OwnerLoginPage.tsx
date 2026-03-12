/**
 * OwnerLoginPage — Owner Dashboard Web App
 * Email + password OR Google sign-in with "Register Business" flow.
 */

import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable }          from 'firebase/functions';
import { auth, firestore, functions } from '../config/firebase';

type Mode = 'login' | 'register';
const googleProvider = new GoogleAuthProvider();

export default function OwnerLoginPage() {
  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [bizName,  setBizName]  = useState('');
  const [note,     setNote]     = useState('');
  const [step,     setStep]     = useState<'credentials' | 'business'>('credentials');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [pendingGoogleUid, setPendingGoogleUid] = useState('');
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState('');

  // ── Google Sign-In ────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError(''); setGLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Check if this Google user already has a tenant registered
      // If not, move them to the business registration step
      const token = await result.user.getIdTokenResult();
      if (!token.claims['tenantId']) {
        // New Google user — need business details
        setPendingGoogleUid(result.user.uid);
        setPendingGoogleEmail(result.user.email || '');
        setName(result.user.displayName || '');
        setEmail(result.user.email || '');
        setMode('register');
        setStep('business');
      }
      // If tenantId exists, useOwnerAuth hook will handle redirect
    } catch (err: any) {
      setError(err.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : err.message);
    } finally { setGLoading(false); }
  };

  // ── Email Login ───────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(
        err.code === 'auth/wrong-password'    ? 'Incorrect password.' :
        err.code === 'auth/user-not-found'    ? 'No account found with this email.' :
        err.code === 'auth/invalid-email'     ? 'Invalid email address.' :
        err.message
      );
    } finally { setLoading(false); }
  };

  // ── Register Step 1 → 2 ───────────────────────────────────────────────────
  const handleCredentialsNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setStep('business');
  };

  // ── Register Step 2: create account + register tenant ────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let uid = pendingGoogleUid;

      if (!uid) {
        // Email registration
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid;
        await setDoc(doc(firestore, 'users', uid), {
          uid, name, phone, email,
          role: 'owner', isActive: true, createdAt: Timestamp.now(),
        });
      } else {
        // Google registration — update user doc with business phone + name
        await setDoc(doc(firestore, 'users', uid), {
          uid, name, phone, email: pendingGoogleEmail,
          role: 'owner', isActive: true, createdAt: Timestamp.now(),
        }, { merge: true });
      }

      const fn = httpsCallable(functions, 'registerTenant');
      await fn({ businessName: bizName, ownerName: name, phone, email: email || pendingGoogleEmail, registrationNote: note });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.code === 'auth/email-already-in-use' ? 'An account with this email already exists. Please log in.' :
        err.message
      );
    } finally { setLoading(false); }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={css.shell}>
        <div style={css.card}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🎉</div>
          <h2 style={css.title}>Registration Submitted!</h2>
          <p style={css.sub}>
            Your account for <strong style={{ color: '#F59E0B' }}>{bizName}</strong> has been created.
            The ParkSmart admin team will review and approve your account within 24 hours.
          </p>
          <p style={css.sub}>You'll receive a notification once approved.</p>
          <button style={css.btn} onClick={() => window.location.reload()}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={css.shell}>
      <div style={css.card}>
        {/* Brand */}
        <div style={css.brand}>
          <span style={{ fontSize: 28, color: '#F59E0B' }}>⬡</span>
          <div>
            <div style={css.brandName}>ParkSmart</div>
            <div style={css.brandSub}>Owner Portal</div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={css.modeRow}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} style={{ ...css.modeBtn, ...(mode === m ? css.modeBtnActive : {}) }}
              onClick={() => { setMode(m); setError(''); setStep('credentials'); setPendingGoogleUid(''); }}>
              {m === 'login' ? 'Sign In' : 'Register Business'}
            </button>
          ))}
        </div>

        {/* Google button — show on login and register step 1 */}
        {(mode === 'login' || (mode === 'register' && step === 'credentials')) && (
          <>
            <button style={css.googleBtn} onClick={handleGoogleSignIn} disabled={gLoading} type="button">
              {gLoading ? 'Signing in…' : (
                <><span style={{ fontSize: 16, marginRight: 8 }}>G</span>
                  {mode === 'login' ? 'Continue with Google' : 'Register with Google'}</>
              )}
            </button>
            <div style={css.divider}><span style={css.dividerText}>or</span></div>
          </>
        )}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <Field label="EMAIL" type="email"    value={email}    onChange={setEmail}    placeholder="owner@business.com" />
            <Field label="PASSWORD" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {error && <div style={css.error}>{error}</div>}
            <button style={css.btn} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        )}

        {/* Register — Step 1: Credentials */}
        {mode === 'register' && step === 'credentials' && (
          <form onSubmit={handleCredentialsNext}>
            <div style={css.stepLabel}>STEP 1 OF 2 — YOUR ACCOUNT</div>
            <Field label="FULL NAME"  type="text"     value={name}     onChange={setName}     placeholder="Your full name" />
            <Field label="EMAIL"      type="email"    value={email}    onChange={setEmail}    placeholder="owner@business.com" />
            <Field label="MOBILE NO." type="tel"      value={phone}    onChange={setPhone}    placeholder="+91 XXXXXXXXXX" />
            <Field label="PASSWORD"   type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
            {error && <div style={css.error}>{error}</div>}
            <button style={css.btn} type="submit">
              Next — Business Details →
            </button>
          </form>
        )}

        {/* Register — Step 2: Business (email or google) */}
        {mode === 'register' && step === 'business' && (
          <form onSubmit={handleRegister}>
            <div style={css.stepLabel}>
              {pendingGoogleUid ? 'GOOGLE SIGN-UP — BUSINESS DETAILS' : 'STEP 2 OF 2 — YOUR BUSINESS'}
            </div>
            {pendingGoogleUid && (
              <div style={{ ...css.error, background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#F59E0B', marginBottom: 16 }}>
                Signed in as {pendingGoogleEmail}. Please complete your business details.
              </div>
            )}
            {!pendingGoogleUid && (
              <Field label="MOBILE NO." type="tel" value={phone} onChange={setPhone} placeholder="+91 XXXXXXXXXX" />
            )}
            <Field label="BUSINESS NAME" type="text" value={bizName} onChange={setBizName} placeholder="e.g. Shivaji Nagar Parking Pvt Ltd" />
            <div style={css.fieldWrap}>
              <label style={css.fieldLabel}>NOTE TO ADMIN (OPTIONAL)</label>
              <textarea style={{ ...css.fieldInput, height: 72, resize: 'vertical' } as React.CSSProperties}
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Brief description of your parking business…" />
            </div>
            {error && <div style={css.error}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              {!pendingGoogleUid && (
                <button type="button" style={{ ...css.btn, background: '#131B2A', color: '#5A7090', flex: 1 }}
                  onClick={() => setStep('credentials')}>← Back</button>
              )}
              <button style={{ ...css.btn, flex: 2 }} type="submit" disabled={loading || !bizName}>
                {loading ? 'Submitting…' : 'Submit for Approval →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={css.fieldWrap}>
      <label style={css.fieldLabel}>{label}</label>
      <input style={css.fieldInput} type={type} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} required />
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  shell:        { minHeight: '100vh', background: '#0A0E1A', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 20,
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  card:         { width: '100%', maxWidth: 420, background: '#131B2A',
                  borderRadius: 20, border: '1px solid #1E2D45', padding: 32 },
  brand:        { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 },
  brandName:    { fontSize: 20, fontWeight: 900, color: '#F0F4FF' },
  brandSub:     { fontSize: 9, color: '#5A7090', letterSpacing: 1.5, textTransform: 'uppercase' },
  modeRow:      { display: 'flex', gap: 8, marginBottom: 24, background: '#0A0E1A',
                  borderRadius: 10, padding: 4 },
  modeBtn:      { flex: 1, background: 'none', border: 'none', color: '#5A7090',
                  fontSize: 13, fontWeight: 600, padding: '8px 0', borderRadius: 8, cursor: 'pointer' },
  modeBtnActive:{ background: '#1E2D45', color: '#F0F4FF' },
  googleBtn:    { width: '100%', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                  padding: '12px', fontSize: 13, fontWeight: 700, color: '#1a1a1a',
                  cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center',
                  justifyContent: 'center' },
  divider:      { position: 'relative', textAlign: 'center', marginBottom: 16,
                  borderTop: '1px solid #1E2D45' },
  dividerText:  { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: '#131B2A', padding: '0 10px', color: '#5A7090', fontSize: 12 },
  stepLabel:    { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#5A7090',
                  textTransform: 'uppercase', marginBottom: 16 },
  fieldWrap:    { marginBottom: 16 },
  fieldLabel:   { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: '#5A7090', textTransform: 'uppercase', marginBottom: 6 },
  fieldInput:   { width: '100%', boxSizing: 'border-box', background: '#0A0E1A',
                  border: '1px solid #1E2D45', borderRadius: 10, padding: '11px 13px',
                  fontSize: 13, color: '#F0F4FF', outline: 'none', fontFamily: 'inherit' },
  btn:          { width: '100%', background: '#F59E0B', border: 'none', borderRadius: 10,
                  padding: '13px', fontSize: 13, fontWeight: 800, color: '#000',
                  cursor: 'pointer', marginTop: 8 },
  error:        { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#EF4444',
                  marginBottom: 12 },
  title:        { fontSize: 20, fontWeight: 800, color: '#F0F4FF', marginBottom: 12, textAlign: 'center' as const },
  sub:          { fontSize: 13, color: '#5A7090', lineHeight: 1.7, marginBottom: 10, textAlign: 'center' as const },
};
