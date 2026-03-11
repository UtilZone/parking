/**
 * LotsPage — Owner Dashboard
 * Create, edit, and manage parking lots.
 * Supports both slot_based and capacity_based modes.
 * Slot_based: add slots in bulk (e.g. A-01 to A-20).
 */

import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, doc,
  addDoc, updateDoc, deleteDoc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { firestore } from '../config/firebase';

type ParkingMode = 'slot_based' | 'capacity_based';

interface Lot {
  lotId:         string;
  name:          string;
  address:       string;
  city:          string;
  parkingMode:   ParkingMode;
  totalCapacity: number;
  currentCount:  number;
  allowOverflow: boolean;
  totalSlots?:   number;
  isActive:      boolean;
  rateCard:      Record<string, number>;
  penaltyRules:  { overstayThresholdHours: number; penaltyPerHour: number; maxDailyCharge: number };
  revenue?:      { today: number; month: number; total: number };
}

const DEFAULT_RATES  = { car: 30, bike: 10, auto: 20, truck: 60 };
const DEFAULT_PENALTY = { overstayThresholdHours: 4, penaltyPerHour: 20, maxDailyCharge: 500 };
const EMPTY_LOT: Omit<Lot, 'lotId'> = {
  name: '', address: '', city: '', parkingMode: 'capacity_based',
  totalCapacity: 50, currentCount: 0, allowOverflow: false,
  isActive: true, rateCard: { ...DEFAULT_RATES }, penaltyRules: { ...DEFAULT_PENALTY },
};

interface Props { tenantId: string; }

export default function LotsPage({ tenantId }: Props) {
  const [lots,      setLots]      = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing,   setEditing]   = useState<Partial<Lot> | null>(null);
  const [isNew,     setIsNew]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');
  // Slot bulk-add form
  const [showSlots,   setShowSlots]   = useState(false);
  const [slotLotId,   setSlotLotId]   = useState('');
  const [slotPrefix,  setSlotPrefix]  = useState('A');
  const [slotFrom,    setSlotFrom]    = useState(1);
  const [slotTo,      setSlotTo]      = useState(20);
  const [slotAdding,  setSlotAdding]  = useState(false);

  useEffect(() => {
    const q = query(collection(firestore, 'tenants', tenantId, 'parkingLots'));
    return onSnapshot(q, snap => {
      setLots(snap.docs.map(d => ({ ...d.data(), lotId: d.id }) as Lot));
      setIsLoading(false);
    });
  }, [tenantId]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // ── Save lot ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editing?.name || !editing.address || !editing.city) {
      flash('❌ Name, address and city are required.'); return;
    }
    setSaving(true);
    try {
      const lotsRef = collection(firestore, 'tenants', tenantId, 'parkingLots');
      if (isNew) {
        await addDoc(lotsRef, { ...editing, currentCount: 0, createdAt: Timestamp.now() });
        flash('✅ Parking lot created!');
      } else {
        const { lotId, ...data } = editing as Lot;
        await updateDoc(doc(lotsRef, lotId), data);
        flash('✅ Lot updated.');
      }
      setEditing(null);
    } catch (e: any) { flash(`❌ ${e.message}`); }
    finally { setSaving(false); }
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = async (lot: Lot) => {
    await updateDoc(doc(firestore, 'tenants', tenantId, 'parkingLots', lot.lotId), {
      isActive: !lot.isActive,
    });
    flash(`✅ Lot ${lot.isActive ? 'deactivated' : 'activated'}.`);
  };

  // ── Bulk add slots ───────────────────────────────────────────────────────
  const handleAddSlots = async () => {
    if (!slotLotId || slotFrom > slotTo) return;
    setSlotAdding(true);
    const batch    = writeBatch(firestore);
    const slotsRef = collection(firestore, 'tenants', tenantId, 'parkingLots', slotLotId, 'slots');
    for (let i = slotFrom; i <= slotTo; i++) {
      const slotId = `${slotPrefix}-${String(i).padStart(2, '0')}`;
      batch.set(doc(slotsRef, slotId), {
        slotId, lotId: slotLotId, tenantId,
        status: 'free', currentSessionId: null, vehicleType: null,
        lastUpdated: Timestamp.now(),
      });
    }
    const count = slotTo - slotFrom + 1;
    await updateDoc(doc(firestore, 'tenants', tenantId, 'parkingLots', slotLotId), {
      totalSlots: count,
    });
    await batch.commit();
    setSlotAdding(false);
    setShowSlots(false);
    flash(`✅ ${count} slots added (${slotPrefix}-${String(slotFrom).padStart(2,'0')} → ${slotPrefix}-${String(slotTo).padStart(2,'0')}).`);
  };

  if (isLoading) return <div style={css.loading}>Loading lots…</div>;

  return (
    <div style={css.page}>
      <div style={css.header}>
        <h1 style={css.title}>Parking Locations</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={css.secondaryBtn}
            onClick={() => { setShowSlots(true); setSlotLotId(lots.find(l => l.parkingMode === 'slot_based')?.lotId || ''); }}>
            🔢 Manage Slots
          </button>
          <button style={css.primaryBtn} onClick={() => { setEditing({ ...EMPTY_LOT }); setIsNew(true); }}>
            + Add Location
          </button>
        </div>
      </div>

      {msg && <div style={css.flash}>{msg}</div>}

      {/* Lot cards */}
      <div style={css.lotsGrid}>
        {lots.map(lot => (
          <div key={lot.lotId} style={{ ...css.lotCard, opacity: lot.isActive ? 1 : 0.55 }}>
            <div style={css.lotCardTop}>
              <div>
                <div style={css.lotName}>{lot.name}</div>
                <div style={css.lotCity}>{lot.address}, {lot.city}</div>
              </div>
              <div style={css.lotBadges}>
                <span style={{ ...css.modeBadge,
                  background: lot.parkingMode === 'slot_based' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                  color:      lot.parkingMode === 'slot_based' ? '#3B82F6' : '#10B981',
                }}>
                  {lot.parkingMode === 'slot_based' ? '🔢 Slot' : '📊 Capacity'}
                </span>
                <span style={{ ...css.modeBadge,
                  background: lot.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color:      lot.isActive ? '#10B981' : '#EF4444',
                }}>
                  {lot.isActive ? 'Active' : 'Closed'}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={css.statsRow}>
              <div style={css.stat}>
                <span style={{ ...css.statVal, color: '#F59E0B' }}>₹{lot.revenue?.today ?? 0}</span>
                <span style={css.statLabel}>Today</span>
              </div>
              <div style={css.stat}>
                <span style={{ ...css.statVal, color: '#10B981' }}>
                  {lot.parkingMode === 'capacity_based'
                    ? `${lot.currentCount ?? 0}/${lot.totalCapacity}`
                    : `${lot.totalSlots ?? 0} slots`}
                </span>
                <span style={css.statLabel}>
                  {lot.parkingMode === 'capacity_based' ? 'Occupancy' : 'Total Slots'}
                </span>
              </div>
              <div style={css.stat}>
                <span style={{ ...css.statVal, color: '#3B82F6' }}>₹{lot.rateCard?.car ?? 0}/hr</span>
                <span style={css.statLabel}>Car Rate</span>
              </div>
            </div>

            {/* Capacity bar */}
            {lot.parkingMode === 'capacity_based' && (
              <div style={css.capBarWrap}>
                <div style={{ ...css.capBarFill,
                  width: `${Math.min(100, ((lot.currentCount ?? 0) / (lot.totalCapacity || 1)) * 100)}%`,
                  background: (lot.currentCount ?? 0) >= lot.totalCapacity ? '#EF4444' : '#10B981',
                }} />
              </div>
            )}

            <div style={css.lotActions}>
              <button style={css.editBtn} onClick={() => { setEditing({ ...lot }); setIsNew(false); }}>Edit</button>
              <button style={{ ...css.editBtn, color: lot.isActive ? '#EF4444' : '#10B981' }}
                onClick={() => toggleActive(lot)}>
                {lot.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}

        {lots.length === 0 && (
          <div style={css.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🅿️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 8 }}>No locations yet</div>
            <div style={{ fontSize: 13, color: '#5A7090' }}>Add your first parking lot to get started.</div>
          </div>
        )}
      </div>

      {/* Edit / Create modal */}
      {editing && (
        <div style={css.overlay}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <h2 style={css.modalTitle}>{isNew ? '+ New Parking Location' : 'Edit Lot'}</h2>
              <button style={css.closeBtn} onClick={() => setEditing(null)}>✕</button>
            </div>
            <div style={css.modalBody}>
              <F label="Location Name"    val={editing.name     || ''} set={v => setEditing(e => ({ ...e!, name: v }))}     placeholder="e.g. MG Road Parking" />
              <F label="Street Address"   val={editing.address  || ''} set={v => setEditing(e => ({ ...e!, address: v }))}  placeholder="123, MG Road" />
              <F label="City"             val={editing.city     || ''} set={v => setEditing(e => ({ ...e!, city: v }))}     placeholder="Pune" />

              {/* Parking mode */}
              <div style={css.fieldRow}>
                <label style={css.fl}>PARKING MODE</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['capacity_based', 'slot_based'] as ParkingMode[]).map(m => (
                    <button key={m}
                      style={{ ...css.modeToggle, ...(editing.parkingMode === m ? css.modeToggleActive : {}) }}
                      onClick={() => setEditing(e => ({ ...e!, parkingMode: m }))}>
                      {m === 'slot_based' ? '🔢 Slot-based' : '📊 Capacity-based'}
                    </button>
                  ))}
                </div>
              </div>

              {editing.parkingMode === 'capacity_based' && (
                <>
                  <FNum label="Max Capacity (vehicles)"  val={editing.totalCapacity ?? 50}
                    set={v => setEditing(e => ({ ...e!, totalCapacity: v }))} />
                  <div style={css.fieldRow}>
                    <label style={css.fl}>ALLOW OVERFLOW?</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[true, false].map(v => (
                        <button key={String(v)}
                          style={{ ...css.modeToggle, ...(editing.allowOverflow === v ? css.modeToggleActive : {}) }}
                          onClick={() => setEditing(e => ({ ...e!, allowOverflow: v }))}>
                          {v ? '✅ Yes (warn attendant)' : '🚫 No (hard block)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Rate card */}
              <div style={css.rateGrid}>
                <label style={{ ...css.fl, gridColumn: '1/-1' }}>RATES (₹/hr)</label>
                {['car', 'bike', 'auto', 'truck'].map(v => (
                  <div key={v}>
                    <label style={{ ...css.fl, textTransform: 'capitalize' as const }}>{v}</label>
                    <input style={css.numInput} type="number" min={0}
                      value={(editing.rateCard ?? DEFAULT_RATES)[v] ?? 0}
                      onChange={e => setEditing(ed => ({
                        ...ed!,
                        rateCard: { ...(ed!.rateCard ?? DEFAULT_RATES), [v]: Number(e.target.value) },
                      }))} />
                  </div>
                ))}
              </div>

              {/* Penalty rules */}
              <div style={css.rateGrid}>
                <label style={{ ...css.fl, gridColumn: '1/-1' }}>OVERSTAY PENALTY</label>
                <div>
                  <label style={css.fl}>After (hrs)</label>
                  <input style={css.numInput} type="number" min={1}
                    value={(editing.penaltyRules ?? DEFAULT_PENALTY).overstayThresholdHours}
                    onChange={e => setEditing(ed => ({ ...ed!, penaltyRules: { ...(ed!.penaltyRules ?? DEFAULT_PENALTY), overstayThresholdHours: Number(e.target.value) } }))} />
                </div>
                <div>
                  <label style={css.fl}>Penalty/hr (₹)</label>
                  <input style={css.numInput} type="number" min={0}
                    value={(editing.penaltyRules ?? DEFAULT_PENALTY).penaltyPerHour}
                    onChange={e => setEditing(ed => ({ ...ed!, penaltyRules: { ...(ed!.penaltyRules ?? DEFAULT_PENALTY), penaltyPerHour: Number(e.target.value) } }))} />
                </div>
                <div>
                  <label style={css.fl}>Daily max cap (₹)</label>
                  <input style={css.numInput} type="number" min={0}
                    value={(editing.penaltyRules ?? DEFAULT_PENALTY).maxDailyCharge}
                    onChange={e => setEditing(ed => ({ ...ed!, penaltyRules: { ...(ed!.penaltyRules ?? DEFAULT_PENALTY), maxDailyCharge: Number(e.target.value) } }))} />
                </div>
              </div>
            </div>
            <div style={css.modalFooter}>
              <button style={css.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
              <button style={{ ...css.primaryBtn, minWidth: 140 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : isNew ? 'Create Lot' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot management modal */}
      {showSlots && (
        <div style={css.overlay}>
          <div style={{ ...css.modal, maxWidth: 440 }}>
            <div style={css.modalHeader}>
              <h2 style={css.modalTitle}>🔢 Add Slots in Bulk</h2>
              <button style={css.closeBtn} onClick={() => setShowSlots(false)}>✕</button>
            </div>
            <div style={css.modalBody}>
              <div style={css.fieldRow}>
                <label style={css.fl}>PARKING LOT</label>
                <select style={css.select} value={slotLotId} onChange={e => setSlotLotId(e.target.value)}>
                  <option value="">— Select lot —</option>
                  {lots.filter(l => l.parkingMode === 'slot_based').map(l => (
                    <option key={l.lotId} value={l.lotId}>{l.name}</option>
                  ))}
                </select>
                {lots.filter(l => l.parkingMode === 'slot_based').length === 0 && (
                  <p style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>
                    No slot-based lots. Create a slot_based lot first.
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={css.fl}>PREFIX</label>
                  <input style={css.numInput} value={slotPrefix} onChange={e => setSlotPrefix(e.target.value.toUpperCase())} placeholder="A" maxLength={3} />
                </div>
                <div>
                  <label style={css.fl}>FROM #</label>
                  <input style={css.numInput} type="number" min={1} value={slotFrom} onChange={e => setSlotFrom(Number(e.target.value))} />
                </div>
                <div>
                  <label style={css.fl}>TO #</label>
                  <input style={css.numInput} type="number" min={slotFrom} value={slotTo} onChange={e => setSlotTo(Number(e.target.value))} />
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#0A0E1A', borderRadius: 8, fontSize: 12, color: '#5A7090' }}>
                Will create: <strong style={{ color: '#F0F4FF' }}>
                  {slotTo - slotFrom + 1} slots
                </strong> — {slotPrefix}-{String(slotFrom).padStart(2,'0')} to {slotPrefix}-{String(slotTo).padStart(2,'0')}
              </div>
            </div>
            <div style={css.modalFooter}>
              <button style={css.cancelBtn} onClick={() => setShowSlots(false)}>Cancel</button>
              <button style={css.primaryBtn} onClick={handleAddSlots} disabled={slotAdding || !slotLotId}>
                {slotAdding ? 'Adding…' : `Add ${slotTo - slotFrom + 1} Slots`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny helpers
function F({ label, val, set, placeholder }: { label: string; val: string; set: (v: string) => void; placeholder: string }) {
  return (
    <div style={css.fieldRow}>
      <label style={css.fl}>{label.toUpperCase()}</label>
      <input style={css.fi} value={val} onChange={e => set(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function FNum({ label, val, set }: { label: string; val: number; set: (v: number) => void }) {
  return (
    <div style={css.fieldRow}>
      <label style={css.fl}>{label.toUpperCase()}</label>
      <input style={css.fi} type="number" min={1} value={val} onChange={e => set(Number(e.target.value))} />
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  page:     { padding: 28, background: '#0A0E1A', minHeight: '100vh',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#F0F4FF' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:    { fontSize: 22, fontWeight: 800, letterSpacing: -0.5, margin: 0 },
  loading:  { color: '#5A7090', padding: 40 },
  flash:    { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#10B981' },

  lotsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  lotCard:   { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 16, padding: 20 },
  lotCardTop:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  lotName:   { fontSize: 15, fontWeight: 800, marginBottom: 3 },
  lotCity:   { fontSize: 11, color: '#5A7090' },
  lotBadges: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  modeBadge: { fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' as const },
  statsRow:  { display: 'flex', justifyContent: 'space-between', margin: '12px 0', padding: '10px 0',
               borderTop: '1px solid #1E2D45', borderBottom: '1px solid #1E2D45' },
  stat:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statVal:   { fontSize: 15, fontWeight: 800, fontFamily: 'monospace' },
  statLabel: { fontSize: 9, color: '#5A7090', letterSpacing: 0.5 },
  capBarWrap:{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', margin: '8px 0' },
  capBarFill:{ height: '100%', borderRadius: 99, transition: 'width 0.4s' },
  lotActions:{ display: 'flex', gap: 10, marginTop: 12 },
  editBtn:   { background: 'rgba(255,255,255,0.04)', border: '1px solid #1E2D45', borderRadius: 8,
               padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#F0F4FF' },
  empty:     { gridColumn: '1/-1', textAlign: 'center' as const, padding: '60px 20px' },

  // Modal
  overlay:     { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal:       { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 20,
                 width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                 padding: '20px 24px', borderBottom: '1px solid #1E2D45' },
  modalTitle:  { fontSize: 16, fontWeight: 800, margin: 0 },
  closeBtn:    { background: 'none', border: 'none', color: '#5A7090', fontSize: 18,
                 cursor: 'pointer', padding: 4 },
  modalBody:   { padding: '20px 24px', overflowY: 'auto' as const, flex: 1 },
  modalFooter: { display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #1E2D45',
                 justifyContent: 'flex-end' },

  fieldRow:     { marginBottom: 16 },
  fl:           { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: '#5A7090', textTransform: 'uppercase' as const, marginBottom: 6 },
  fi:           { width: '100%', boxSizing: 'border-box' as const, background: '#0A0E1A',
                  border: '1px solid #1E2D45', borderRadius: 10, padding: '10px 12px',
                  fontSize: 13, color: '#F0F4FF', outline: 'none', fontFamily: 'inherit' },
  rateGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  numInput:     { width: '100%', boxSizing: 'border-box' as const, background: '#0A0E1A',
                  border: '1px solid #1E2D45', borderRadius: 8, padding: '8px 10px',
                  fontSize: 13, color: '#F0F4FF', outline: 'none', fontFamily: 'monospace' },
  modeToggle:   { flex: 1, background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 8,
                  padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#5A7090' },
  modeToggleActive: { borderColor: '#F59E0B', background: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
  select:       { width: '100%', background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, color: '#F0F4FF', outline: 'none' },

  primaryBtn:   { background: '#F59E0B', border: 'none', borderRadius: 10, padding: '10px 20px',
                  fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer' },
  secondaryBtn: { background: '#1E2D45', border: '1px solid #253550', borderRadius: 10, padding: '10px 16px',
                  fontSize: 13, fontWeight: 600, color: '#F0F4FF', cursor: 'pointer' },
  cancelBtn:    { background: 'none', border: '1px solid #1E2D45', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 600, color: '#5A7090', cursor: 'pointer' },
};
