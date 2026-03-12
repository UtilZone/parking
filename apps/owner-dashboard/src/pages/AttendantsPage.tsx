/**
 * AttendantsPage — Owner Dashboard
 * View attendants, assign them to lots, deactivate access.
 * Attendants join via phone OTP; owner assigns role + lots here.
 */

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../config/firebase';

interface Attendant {
  uid:           string;
  name:          string;
  phone:         string;
  assignedLotIds:string[];
  isActive:      boolean;
  createdAt:     any;
  role:          string;
}

interface Lot {
  lotId: string; name: string; city: string;
}

interface Props { tenantId: string; }

export default function AttendantsPage({ tenantId }: Props) {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [lots,       setLots]       = useState<Lot[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [msg,        setMsg]        = useState('');
  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invName,    setInvName]    = useState('');
  const [invEmail,   setInvEmail]   = useState('');
  const [invPassword,setInvPassword]= useState('');
  const [invPhone,   setInvPhone]   = useState('');
  const [invLots,    setInvLots]    = useState<string[]>([]);
  const [inviting,   setInviting]   = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  // Edit assignments
  const [editing,    setEditing]    = useState<Attendant | null>(null);
  const [editLots,   setEditLots]   = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  useEffect(() => {
    const q = query(
      collection(firestore, 'users'),
      where('tenantId', '==', tenantId),
      where('role', '==', 'attendant')
    );
    return onSnapshot(q, snap => {
      setAttendants(snap.docs.map(d => ({ ...d.data(), uid: d.id }) as Attendant));
      setIsLoading(false);
    });
  }, [tenantId]);

  useEffect(() => {
    const q = query(collection(firestore, 'tenants', tenantId, 'parkingLots'));
    return onSnapshot(q, snap => {
      setLots(snap.docs.map(d => ({ ...d.data(), lotId: d.id }) as Lot));
    });
  }, [tenantId]);

  // ── Create attendant with email + password ──────────────────────────────
  const handleInvite = async () => {
    if (!invName || !invEmail || !invPassword) {
      flash('❌ Name, email and password are required.'); return;
    }
    if (invPassword.length < 8) { flash('❌ Password must be at least 8 characters.'); return; }
    setInviting(true);
    try {
      const fn = httpsCallable(functions, 'createAttendant');
      await fn({
        name: invName,
        email: invEmail.trim(),
        password: invPassword,
        phone: invPhone ? `+91${invPhone.replace(/\D/g, '')}` : '',
        assignedLotIds: invLots,
      });
      flash(`✅ ${invName} added. They can log in with ${invEmail} on the Attendant app.`);
      setShowInvite(false);
      setInvName(''); setInvEmail(''); setInvPassword(''); setInvPhone(''); setInvLots([]);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
      setShowInvite(false);
    } finally { setInviting(false); }
  };

  // ── Save lot assignments ─────────────────────────────────────────────────
  const handleSaveAssignments = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', editing.uid), { assignedLotIds: editLots });
      // Refresh custom claims via Cloud Function
      await httpsCallable(functions, 'assignRole')({
        targetUid: editing.uid,
        role: 'attendant',
        assignedLotIds: editLots,
      });
      flash('✅ Lot assignments saved.');
      setEditing(null);
    } catch (e: any) { flash(`❌ ${e.message}`); }
    finally { setSaving(false); }
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = async (a: Attendant) => {
    await updateDoc(doc(firestore, 'users', a.uid), { isActive: !a.isActive });
    flash(`✅ ${a.name} ${a.isActive ? 'deactivated' : 'reactivated'}.`);
  };

  if (isLoading) return <div style={css.loading}>Loading attendants…</div>;

  const lotName = (id: string) => lots.find(l => l.lotId === id)?.name || id;

  return (
    <div style={css.page}>
      <div style={css.header}>
        <h1 style={css.title}>Attendants</h1>
        <button style={css.primaryBtn} onClick={() => setShowInvite(true)}>
          + Add Attendant
        </button>
      </div>

      {msg && <div style={css.flash}>{msg}</div>}

      {/* Attendant table */}
      {attendants.length === 0 ? (
        <div style={css.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 8 }}>No attendants yet</div>
          <div style={{ fontSize: 13, color: '#5A7090', marginBottom: 20 }}>
            Add your parking staff to let them use the Attendant app.
          </div>
          <button style={css.primaryBtn} onClick={() => setShowInvite(true)}>Add First Attendant</button>
        </div>
      ) : (
        <table style={css.table}>
          <thead>
            <tr>
              {['Name', 'Phone', 'Assigned Lots', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={css.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendants.map(a => (
              <tr key={a.uid} style={{ ...css.tr, opacity: a.isActive ? 1 : 0.5 }}>
                <td style={css.tdBold}>{a.name}</td>
                <td style={{ ...css.td, fontFamily: 'monospace' }}>{a.phone}</td>
                <td style={css.td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(a.assignedLotIds || []).length === 0
                      ? <span style={css.noLots}>Not assigned</span>
                      : (a.assignedLotIds || []).map(id => (
                        <span key={id} style={css.lotChip}>{lotName(id)}</span>
                      ))
                    }
                  </div>
                </td>
                <td style={css.td}>
                  <span style={{ ...css.chip,
                    background: a.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                    color: a.isActive ? '#10B981' : '#EF4444',
                  }}>
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ ...css.td, color: '#5A7090' }}>
                  {a.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '—'}
                </td>
                <td style={css.td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={css.actionBtn} onClick={() => { setEditing(a); setEditLots(a.assignedLotIds || []); }}>
                      Assign Lots
                    </button>
                    <button style={{ ...css.actionBtn, color: a.isActive ? '#EF4444' : '#10B981' }}
                      onClick={() => toggleActive(a)}>
                      {a.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add attendant modal */}
      {showInvite && (
        <div style={css.overlay} onClick={() => setShowInvite(false)}>
          <div style={css.modal} onClick={e => e.stopPropagation()}>
            <div style={css.modalHeader}>
              <h2 style={css.modalTitle}>+ Add Attendant</h2>
              <button style={css.closeBtn} onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <div style={css.modalBody}>
              <p style={css.hint}>
                Create login credentials for your staff member. Share the email and password with them
                to log in on the Attendant app.
              </p>
              <Label>FULL NAME</Label>
              <input style={css.input} value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
              <Label>EMAIL (LOGIN ID)</Label>
              <input style={css.input} type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="ramesh@yourcompany.com" />
              <Label>PASSWORD</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...css.input, flex: 1 }} type={showPass ? 'text' : 'password'}
                  value={invPassword} onChange={e => setInvPassword(e.target.value)} placeholder="Min. 8 characters" />
                <button type="button" style={{ ...css.input, width: 44, cursor: 'pointer', textAlign: 'center' as const }}
                  onClick={() => setShowPass(p => !p)}>{showPass ? '🙈' : '👁️'}</button>
              </div>
              <Label>MOBILE NUMBER (OPTIONAL)</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#5A7090', fontSize: 13, fontWeight: 700 }}>+91</span>
                <input style={{ ...css.input, flex: 1, fontFamily: 'monospace' }}
                  value={invPhone} onChange={e => setInvPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98XXXXXXXX" />
              </div>
              <Label>ASSIGN TO LOTS</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lots.map(l => (
                  <label key={l.lotId} style={css.lotCheckRow}>
                    <input type="checkbox" checked={invLots.includes(l.lotId)}
                      onChange={e => setInvLots(prev => e.target.checked ? [...prev, l.lotId] : prev.filter(x => x !== l.lotId))} />
                    <span style={{ fontSize: 13, color: '#F0F4FF' }}>{l.name}</span>
                    <span style={{ fontSize: 11, color: '#5A7090' }}>{l.city}</span>
                  </label>
                ))}
                {lots.length === 0 && <p style={{ color: '#5A7090', fontSize: 12 }}>Create a parking lot first, then assign attendants.</p>}
              </div>
            </div>
            <div style={css.modalFooter}>
              <button style={css.cancelBtn} onClick={() => setShowInvite(false)}>Cancel</button>
              <button style={css.primaryBtn} onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Adding…' : 'Add Attendant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign lots modal */}
      {editing && (
        <div style={css.overlay}>
          <div style={{ ...css.modal, maxWidth: 440 }}>
            <div style={css.modalHeader}>
              <h2 style={css.modalTitle}>Assign Lots — {editing.name}</h2>
              <button style={css.closeBtn} onClick={() => setEditing(null)}>✕</button>
            </div>
            <div style={css.modalBody}>
              <p style={css.hint}>Select which parking locations {editing.name} can work at.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lots.map(l => (
                  <label key={l.lotId} style={css.lotCheckRow}>
                    <input type="checkbox" checked={editLots.includes(l.lotId)}
                      onChange={e => setEditLots(prev => e.target.checked ? [...prev, l.lotId] : prev.filter(x => x !== l.lotId))} />
                    <span style={{ fontSize: 13, color: '#F0F4FF' }}>{l.name}</span>
                    <span style={{ fontSize: 11, color: '#5A7090' }}>{l.city}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={css.modalFooter}>
              <button style={css.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
              <button style={css.primaryBtn} onClick={handleSaveAssignments} disabled={saving}>
                {saving ? 'Saving…' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#5A7090', textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 16 }}>{children}</label>;
}

const css: Record<string, React.CSSProperties> = {
  page:     { padding: 28, background: '#0A0E1A', minHeight: '100vh',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#F0F4FF' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:    { fontSize: 22, fontWeight: 800, margin: 0 },
  loading:  { color: '#5A7090', padding: 40 },
  flash:    { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#10B981' },
  empty:    { textAlign: 'center' as const, paddingTop: 60 },

  table:    { width: '100%', borderCollapse: 'collapse' as const, background: '#131B2A',
              borderRadius: 14, overflow: 'hidden', border: '1px solid #1E2D45' },
  th:       { fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#5A7090', textTransform: 'uppercase' as const,
              padding: '10px 14px', textAlign: 'left' as const, borderBottom: '1px solid #1E2D45',
              background: '#0E1420' },
  tr:       { borderBottom: '1px solid rgba(30,45,69,0.6)' },
  td:       { fontSize: 12, color: '#F0F4FF', padding: '12px 14px' },
  tdBold:   { fontSize: 13, fontWeight: 700, color: '#F0F4FF', padding: '12px 14px' },
  chip:     { padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 },
  noLots:   { fontSize: 11, color: '#3A506B', fontStyle: 'italic' },
  lotChip:  { background: 'rgba(59,130,246,0.12)', color: '#3B82F6', borderRadius: 6,
              padding: '2px 8px', fontSize: 10, fontWeight: 600 },
  actionBtn:{ background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 7,
              padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#F0F4FF' },

  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.72)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal:      { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 20,
                width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 24px', borderBottom: '1px solid #1E2D45' },
  modalTitle: { fontSize: 16, fontWeight: 800, margin: 0 },
  closeBtn:   { background: 'none', border: 'none', color: '#5A7090', fontSize: 18, cursor: 'pointer', padding: 4 },
  modalBody:  { padding: '20px 24px', overflowY: 'auto' as const, flex: 1 },
  modalFooter:{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #1E2D45', justifyContent: 'flex-end' },
  hint:       { fontSize: 12, color: '#5A7090', lineHeight: 1.7, marginBottom: 4, marginTop: 0 },
  input:      { width: '100%', boxSizing: 'border-box' as const, background: '#0A0E1A', border: '1px solid #1E2D45',
                borderRadius: 10, padding: '10px 13px', fontSize: 13, color: '#F0F4FF',
                outline: 'none', fontFamily: 'inherit' },
  lotCheckRow:{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: '#0A0E1A', borderRadius: 10, cursor: 'pointer' },

  primaryBtn:  { background: '#F59E0B', border: 'none', borderRadius: 10, padding: '10px 20px',
                 fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer' },
  cancelBtn:   { background: 'none', border: '1px solid #1E2D45', borderRadius: 10, padding: '10px 18px',
                 fontSize: 13, fontWeight: 600, color: '#5A7090', cursor: 'pointer' },
};
