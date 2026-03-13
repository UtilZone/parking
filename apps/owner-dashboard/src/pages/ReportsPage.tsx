/**
 * ReportsPage — Owner Dashboard
 * Generate revenue reports by date range and lot.
 * Shows totals, method breakdown, top vehicles.
 */

import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { functions, firestore } from '../config/firebase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Lot { lotId: string; name: string; city: string; }
interface ReportResult {
  reportId:           string;
  totalTransactions:  number;
  totalRevenue:       number;
  cashRevenue:        number;
  digitalRevenue:     number;
  byMethod:           Record<string, number>;
  fromDate:           string;
  toDate:             string;
  generatedAt:        string;
  lotId:              string;
}

interface Props { tenantId: string; }

const PIE_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#A78BFA'];

const toInputDate = (d: Date) => d.toISOString().split('T')[0];

export default function ReportsPage({ tenantId }: Props) {
  const [lots,      setLots]      = useState<Lot[]>([]);
  const [lotId,     setLotId]     = useState<string>('all');
  const [fromDate,  setFromDate]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return toInputDate(d);
  });
  const [toDate,    setToDate]    = useState(() => toInputDate(new Date()));
  const [loading,   setLoading]   = useState(false);
  const [report,    setReport]    = useState<ReportResult | null>(null);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const q = query(collection(firestore, 'tenants', tenantId, 'parkingLots'));
    return onSnapshot(q, snap => {
      setLots(snap.docs.map(d => ({ ...d.data(), lotId: d.id }) as Lot));
    });
  }, [tenantId]);

  const handleGenerate = async () => {
    setLoading(true); setError(''); setReport(null);
    try {
      const fn = httpsCallable<object, ReportResult>(functions, 'generateReport');
      const res = await fn({
        tenantId,
        lotId:    lotId === 'all' ? undefined : lotId,
        fromDate, toDate,
      });
      setReport(res.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const pieData = report
    ? Object.entries(report.byMethod).map(([name, value]) => ({ name, value }))
    : [];

  const lotName = (id: string) => id === 'all' ? 'All Locations' : lots.find(l => l.lotId === id)?.name || id;

  return (
    <div style={css.page}>
      <h1 style={css.title}>Reports</h1>

      {/* Filters */}
      <div style={css.filterCard}>
        <div style={css.filterGrid}>
          <div>
            <label style={css.fl}>LOCATION</label>
            <select style={css.select} value={lotId} onChange={e => setLotId(e.target.value)}>
              <option value="all">All Locations</option>
              {lots.map(l => <option key={l.lotId} value={l.lotId}>{l.name} — {l.city}</option>)}
            </select>
          </div>
          <div>
            <label style={css.fl}>FROM DATE</label>
            <input style={css.dateInput} type="date" value={fromDate}
              onChange={e => setFromDate(e.target.value)} max={toDate} />
          </div>
          <div>
            <label style={css.fl}>TO DATE</label>
            <input style={css.dateInput} type="date" value={toDate}
              onChange={e => setToDate(e.target.value)} min={fromDate} max={toInputDate(new Date())} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button style={css.generateBtn} onClick={handleGenerate} disabled={loading}>
              {loading ? '⏳ Generating…' : '📈 Generate Report'}
            </button>
          </div>
        </div>

        {/* Quick preset buttons */}
        <div style={css.presets}>
          {[
            { label: 'Today',       days: 0 },
            { label: 'Last 7 days', days: 7 },
            { label: 'This month',  days: 30 },
            { label: 'Last 90 days',days: 90 },
          ].map(p => (
            <button key={p.label} style={css.presetBtn} onClick={() => {
              const to   = new Date();
              const from = new Date(); from.setDate(from.getDate() - p.days);
              setFromDate(toInputDate(from)); setToDate(toInputDate(to));
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={css.errorBox}>{error}</div>}

      {/* Report results */}
      {report && (
        <>
          <div style={css.reportHeader}>
            <div>
              <div style={css.reportTitle}>{lotName(report.lotId)}</div>
              <div style={css.reportDateRange}>
                {new Date(report.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' '} — {' '}
                {new Date(report.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={css.reportMeta}>
              Generated {new Date(report.generatedAt).toLocaleTimeString('en-IN')}
            </div>
          </div>

          {/* Summary stat cards */}
          <div style={css.statGrid}>
            {[
              { label: 'Total Revenue',      value: `₹${report.totalRevenue.toLocaleString('en-IN')}`, color: '#F59E0B', icon: '💰' },
              { label: 'Transactions',       value: String(report.totalTransactions),                   color: '#10B981', icon: '🎫' },
              { label: 'Cash Collected',     value: `₹${report.cashRevenue.toLocaleString('en-IN')}`,  color: '#EF4444', icon: '💵' },
              { label: 'Digital Payments',   value: `₹${report.digitalRevenue.toLocaleString('en-IN')}`, color: '#3B82F6', icon: '📱' },
            ].map((s, i) => (
              <div key={i} style={{ ...css.statCard, borderTop: `3px solid ${s.color}` }}>
                <div style={css.statIcon}>{s.icon}</div>
                <div style={{ ...css.statVal, color: s.color }}>{s.value}</div>
                <div style={css.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={css.chartsRow}>
            {/* Payment method breakdown - pie */}
            <div style={css.chartCard}>
              <div style={css.chartTitle}>Payment Method Breakdown</div>
              <div style={{ height: 220, overflow: "hidden" }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${v}`, '']} contentStyle={{ background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue by method - bar */}
            <div style={css.chartCard}>
              <div style={css.chartTitle}>Revenue by Payment Method</div>
              <div style={{ height: 220, overflow: "hidden" }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pieData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
                  <XAxis dataKey="name" tick={{ fill: '#5A7090', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#5A7090', fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v: number) => [`₹${v}`, 'Revenue']} contentStyle={{ background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Raw method table */}
          <div style={css.methodTable}>
            <div style={css.chartTitle}>Detailed Breakdown</div>
            <table style={css.table}>
              <thead>
                <tr>
                  {['Payment Method', 'Revenue', '% of Total'].map(h => (
                    <th key={h} style={css.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.byMethod).map(([method, amount]) => (
                  <tr key={method} style={css.tr}>
                    <td style={css.tdBold}>{method}</td>
                    <td style={{ ...css.td, color: '#10B981' }}>₹{amount.toLocaleString('en-IN')}</td>
                    <td style={css.td}>
                      {report.totalRevenue > 0 ? ((amount / report.totalRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
                <tr style={{ ...css.tr, background: 'rgba(245,158,11,0.05)' }}>
                  <td style={css.tdBold}>TOTAL</td>
                  <td style={{ ...css.td, color: '#F59E0B', fontWeight: 800 }}>₹{report.totalRevenue.toLocaleString('en-IN')}</td>
                  <td style={css.td}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {!report && !loading && !error && (
        <div style={css.placeholder}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📈</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F4FF', marginBottom: 8 }}>
            Select a date range and generate a report
          </div>
          <div style={{ fontSize: 13, color: '#5A7090' }}>
            Reports summarise all transactions for the selected period.
          </div>
        </div>
      )}
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  page:     { padding: 28, background: '#0A0E1A', minHeight: 'unset',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#F0F4FF' },
  title:    { fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: -0.5, margin: '0 0 24px' },
  filterCard: { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 16,
                padding: '20px 22px', marginBottom: 24 },
  filterGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 16, alignItems: 'end' },
  fl:       { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#5A7090',
              textTransform: 'uppercase' as const, marginBottom: 6 },
  select:   { width: '100%', background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 10,
              padding: '10px 12px', fontSize: 13, color: '#F0F4FF', outline: 'none' },
  dateInput:{ width: '100%', boxSizing: 'border-box' as const, background: '#0A0E1A', border: '1px solid #1E2D45',
              borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#F0F4FF',
              outline: 'none', colorScheme: 'dark' as const },
  generateBtn: { background: '#F59E0B', border: 'none', borderRadius: 10, padding: '11px 22px',
                 fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  presets:  { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' as const },
  presetBtn:{ background: '#0A0E1A', border: '1px solid #1E2D45', borderRadius: 8, padding: '6px 14px',
              fontSize: 11, fontWeight: 600, color: '#5A7090', cursor: 'pointer' },
  errorBox: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#EF4444' },

  reportHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  reportTitle:     { fontSize: 18, fontWeight: 800 },
  reportDateRange: { fontSize: 13, color: '#5A7090', marginTop: 4 },
  reportMeta:      { fontSize: 11, color: '#3A506B' },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 18 },
  statIcon: { fontSize: 20, marginBottom: 10 },
  statVal:  { fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 4, fontFamily: 'monospace' },
  statLabel:{ fontSize: 11, color: '#5A7090' },

  chartsRow:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  chartCard:  { background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20 },
  chartTitle: { fontSize: 13, fontWeight: 700, marginBottom: 16 },
  methodTable:{ background: '#131B2A', border: '1px solid #1E2D45', borderRadius: 14, padding: 20 },
  table:    { width: '100%', borderCollapse: 'collapse' as const },
  th:       { fontSize: 10, fontWeight: 700, color: '#5A7090', letterSpacing: 1, textTransform: 'uppercase' as const,
              padding: '8px 12px', textAlign: 'left' as const, borderBottom: '1px solid #1E2D45' },
  tr:       { borderBottom: '1px solid rgba(30,45,69,0.5)' },
  td:       { fontSize: 13, padding: '11px 12px', color: '#F0F4FF' },
  tdBold:   { fontSize: 13, fontWeight: 700, padding: '11px 12px', color: '#F0F4FF', textTransform: 'capitalize' as const },
  placeholder:{ textAlign: 'center' as const, paddingTop: 80 },
};
