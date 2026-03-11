// ─────────────────────────────────────────────────────────────────────────────
//  ParkSmart — Shared TypeScript Types  (Multi-Tenant)
//  Package: com.utilzone.parking
// ─────────────────────────────────────────────────────────────────────────────

import { Timestamp } from 'firebase/firestore';

// ── Roles ─────────────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'owner' | 'attendant' | 'customer';

// ── User ──────────────────────────────────────────────────────────────────────

export interface ParkSmartUser {
  uid:             string;
  name:            string;
  phone:           string;
  email?:          string;
  role:            UserRole;
  tenantId?:       string;         // null for superadmin
  assignedLotIds?: string[];       // attendants: list of lots they can work at
  fcmToken?:       string;
  isActive:        boolean;
  createdAt:       Timestamp;
  lastLoginAt?:    Timestamp;
}

// ── Tenant (one per parking business/owner) ───────────────────────────────────

export type TenantStatus = 'pending_approval' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionPlan = 'trial' | 'basic' | 'pro' | 'enterprise';

export interface Tenant {
  tenantId:           string;
  businessName:       string;
  ownerUid:           string;
  ownerName:          string;
  ownerPhone:         string;
  ownerEmail:         string;
  status:             TenantStatus;
  plan:               SubscriptionPlan;
  subscriptionStart?: Timestamp;
  subscriptionEnd?:   Timestamp;
  approvedAt?:        Timestamp;
  approvedBy?:        string;        // superadmin UID
  suspendedAt?:       Timestamp;
  suspendedReason?:   string;
  totalLots:          number;
  createdAt:          Timestamp;
  registrationNote?:  string;        // owner's message during signup
}

// ── Parking Lot ───────────────────────────────────────────────────────────────

export type ParkingMode = 'slot_based' | 'capacity_based';

export interface RateCard {
  car:   number;
  bike:  number;
  auto:  number;
  truck: number;
}

export interface PenaltyRules {
  overstayThresholdHours: number;
  penaltyPerHour:         number;
  maxDailyCharge:         number;
}

export interface ParkingLot {
  lotId:           string;
  tenantId:        string;
  name:            string;
  address:         string;
  city:            string;
  geoLocation?:    { lat: number; lng: number };
  parkingMode:     ParkingMode;
  // Capacity-based fields
  totalCapacity:   number;          // max vehicles allowed
  currentCount:    number;          // live vehicle count
  allowOverflow:   boolean;         // can exceed totalCapacity with warning?
  // Slot-based fields
  totalSlots?:     number;          // set automatically from slots subcollection
  // Shared
  rateCard:        RateCard;
  penaltyRules:    PenaltyRules;
  isActive:        boolean;
  createdAt:       Timestamp;
  // Aggregated (updated by triggers)
  revenue?: {
    today: number;
    month: number;
    total: number;
  };
}

// ── Parking Slot (only for slot_based lots) ───────────────────────────────────

export type SlotStatus = 'free' | 'occupied' | 'reserved';
export type VehicleType = 'car' | 'bike' | 'auto' | 'truck';

export interface ParkingSlot {
  slotId:           string;
  lotId:            string;
  tenantId:         string;
  status:           SlotStatus;
  currentSessionId: string | null;
  vehicleType:      VehicleType | null;
  lastUpdated:      Timestamp;
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus  = 'active' | 'completed' | 'flagged';
export type PaymentMethod  = 'UPI' | 'Cash' | 'Card' | 'Wallet';
export type PaymentStatus  = 'pending' | 'paid';

export interface ParkingSession {
  sessionId:       string;
  tokenNumber:     string;          // e.g. "PKT-0042"
  tenantId:        string;
  lotId:           string;
  parkingMode:     ParkingMode;     // copied from lot at time of entry
  // Slot-based only
  slotId?:         string;
  // Both modes
  plateNumber:     string;          // normalised e.g. "MH12AB4567"
  vehicleType:     VehicleType;
  attendantId:     string;
  shiftId:         string;
  customerId?:     string;
  customerPhone?:  string;
  entryTime:       Timestamp;
  exitTime:        Timestamp | null;
  durationMinutes: number | null;
  chargeAmount:    number | null;
  paymentMethod:   PaymentMethod | null;
  paymentStatus:   PaymentStatus;
  qrCodeData:      string;
  entryImageUrl?:  string;
  status:          SessionStatus;
}

// ── Transaction ───────────────────────────────────────────────────────────────

export interface ParkingTransaction {
  txnId:        string;
  tenantId:     string;
  sessionId:    string;
  lotId:        string;
  attendantId:  string;
  customerId?:  string;
  amount:       number;
  method:       PaymentMethod;
  upiRef?:      string;
  cashPhotoUrl?:string;
  timestamp:    Timestamp;
  receiptSent:  boolean;
}

// ── Shift ─────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'active' | 'closed' | 'flagged';

export interface AttendantShift {
  shiftId:         string;
  tenantId:        string;
  attendantId:     string;
  attendantName:   string;
  lotId:           string;
  startTime:       Timestamp;
  endTime:         Timestamp | null;
  totalCash:       number;
  totalDigital:    number;
  totalRevenue:    number;
  expectedRevenue: number;
  discrepancy:     number;
  vehicleCount:    number;
  status:          ShiftStatus;
}

// ── Anomaly ───────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'low' | 'medium' | 'high';
export type AnomalyType =
  | 'cash_mismatch'
  | 'long_stay_no_payment'
  | 'overflow_exceeded'
  | 'duplicate_plate'
  | 'shift_discrepancy'
  | 'high_manual_entry_rate';

export interface Anomaly {
  anomalyId:   string;
  tenantId:    string;
  lotId:       string;
  type:        AnomalyType;
  severity:    AnomalySeverity;
  description: string;
  relatedId:   string;
  isResolved:  boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt:   Timestamp;
}

// ── Platform Announcement ─────────────────────────────────────────────────────

export interface Announcement {
  announcementId: string;
  title:          string;
  body:           string;
  targetRoles:    UserRole[];       // e.g. ['owner'] or ['owner','attendant']
  isPinned:       boolean;
  createdAt:      Timestamp;
  expiresAt?:     Timestamp;
}

// ── Subscription Plan ─────────────────────────────────────────────────────────

export interface PlanConfig {
  planId:        SubscriptionPlan;
  displayName:   string;
  priceMonthly:  number;
  maxLots:       number;
  maxAttendants: number;
  features:      string[];
}

// ── Cloud Function Payloads ───────────────────────────────────────────────────

export interface VehicleEntryPayload {
  tenantId:       string;
  lotId:          string;
  slotId?:        string;           // only for slot_based
  plateNumber:    string;
  vehicleType:    VehicleType;
  shiftId:        string;
  customerPhone?: string;
  entryImageUrl?: string;
  overrideCapacity?: boolean;       // capacity_based: allow overflow
}

export interface VehicleEntryResult {
  sessionId:     string;
  tokenNumber:   string;
  qrCodeData:    string;
  slotId?:       string;
  entryTime:     string;
  estimatedRate: number;
  isOverflow:    boolean;
  currentCount?: number;
  capacity?:     number;
}

export interface VehicleExitPayload {
  tenantId:      string;
  sessionId:     string;
  paymentMethod: PaymentMethod;
  upiRef?:       string;
  cashPhotoUrl?: string;
}

export interface VehicleExitResult {
  txnId:           string;
  durationMinutes: number;
  baseCharge:      number;
  penaltyCharge:   number;
  totalCharge:     number;
}
