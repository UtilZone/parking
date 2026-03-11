// ─────────────────────────────────────────────────────────────────────────────
//  ParkSmart — Shared Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { TOKEN_PREFIX, PLATE_REGEX } from '../constants';

// ── Plate helpers ─────────────────────────────────────────────────────────────

export const normalisePlate = (raw: string): string =>
  raw.replace(/[\s\-]/g, '').toUpperCase();

export const isValidPlate = (plate: string): boolean =>
  PLATE_REGEX.test(normalisePlate(plate));

// ── Token generation ──────────────────────────────────────────────────────────

export const generateTokenNumber = (counter: number): string =>
  `${TOKEN_PREFIX}-${String(counter).padStart(4, '0')}`;

// ── Fare calculation ──────────────────────────────────────────────────────────

export interface FareInput {
  vehicleType:  string;
  entryTimeMs:  number;
  exitTimeMs:   number;
  rateCard:     Record<string, number>;
  penaltyRules: {
    overstayThresholdHours: number;
    penaltyPerHour:         number;
    maxDailyCharge:         number;
  };
}

export interface FareResult {
  durationMinutes: number;
  billableSlabs:   number;     // 30-min slabs billed
  baseCharge:      number;
  penaltyCharge:   number;
  totalCharge:     number;
}

/**
 * Fare calculation rules:
 * - Billing in 30-minute slabs (rounded up)
 * - If duration > overstayThresholdHours: penalty per extra hour applies
 * - Total capped at maxDailyCharge
 */
export function calculateFare(input: FareInput): FareResult {
  const { vehicleType, entryTimeMs, exitTimeMs, rateCard, penaltyRules } = input;

  const durationMs      = Math.max(exitTimeMs - entryTimeMs, 0);
  const durationMinutes = Math.ceil(durationMs / 60_000);
  const durationHours   = durationMinutes / 60;

  const ratePerHour  = rateCard[vehicleType] ?? 30;
  const billableSlabs= Math.ceil(durationMinutes / 30);   // each slab = 30 min
  const baseCharge   = Math.round(billableSlabs * 0.5 * ratePerHour);

  let penaltyCharge = 0;
  if (durationHours > penaltyRules.overstayThresholdHours) {
    const overstay = durationHours - penaltyRules.overstayThresholdHours;
    penaltyCharge  = Math.round(Math.ceil(overstay) * penaltyRules.penaltyPerHour);
  }

  const totalCharge = Math.min(baseCharge + penaltyCharge, penaltyRules.maxDailyCharge);

  return { durationMinutes, billableSlabs, baseCharge, penaltyCharge, totalCharge };
}

// ── Duration formatting ───────────────────────────────────────────────────────

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// Live duration from entry timestamp to now
export const liveDuration = (entryMs: number): string =>
  formatDuration(Math.floor((Date.now() - entryMs) / 60_000));

// ── QR payload ────────────────────────────────────────────────────────────────

export const buildQrPayload = (sessionId: string, tenantId: string, lotId: string): string =>
  `PSK:${sessionId}:${tenantId}:${lotId}:${Date.now().toString(36)}`;

export const parseQrPayload = (payload: string) => {
  const p = payload.split(':');
  if (p.length < 4 || p[0] !== 'PSK') return null;
  return { sessionId: p[1], tenantId: p[2], lotId: p[3] };
};

// ── Date / time formatting ────────────────────────────────────────────────────

export const fmtTime = (d: Date): string =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtDateTime = (d: Date): string => `${fmtDate(d)}, ${fmtTime(d)}`;

// ── Currency ──────────────────────────────────────────────────────────────────

export const fmtCurrency = (n: number): string =>
  `₹${n.toLocaleString('en-IN')}`;

// ── Capacity helpers ──────────────────────────────────────────────────────────

export const capacityPercent = (current: number, total: number): number =>
  total > 0 ? Math.round((current / total) * 100) : 0;

export const isNearCapacity = (current: number, total: number, threshold = 90): boolean =>
  capacityPercent(current, total) >= threshold;

export const isAtCapacity = (current: number, total: number): boolean =>
  current >= total;
