/**
 * ParkSmart — Cloud Functions Entry Point
 * Package: com.utilzone.parking
 */

import * as admin from 'firebase-admin';
admin.initializeApp();

// Tenant onboarding & superadmin
export {
  registerTenant,
  approveTenant,
  suspendTenant,
  assignRole,
  pushAnnouncement,
  getPlatformStats,
} from './tenant';

// Core parking operations
export {
  vehicleEntry,
  vehicleExit,
  startShift,
  endShift,
  onTransactionCreated,
  generateReport,
  scheduledAnomalyCheck,
} from './parking';
