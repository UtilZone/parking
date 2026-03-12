"use strict";
/**
 * ParkSmart — Cloud Functions Entry Point
 * Package: com.utilzone.parking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledAnomalyCheck = exports.generateReport = exports.transactionReceiptHandler = exports.endShift = exports.startShift = exports.vehicleExit = exports.vehicleEntry = exports.getPlatformStats = exports.pushAnnouncement = exports.createAttendant = exports.assignRole = exports.suspendTenant = exports.approveTenant = exports.registerTenant = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Tenant onboarding & superadmin
var tenant_1 = require("./tenant");
Object.defineProperty(exports, "registerTenant", { enumerable: true, get: function () { return tenant_1.registerTenant; } });
Object.defineProperty(exports, "approveTenant", { enumerable: true, get: function () { return tenant_1.approveTenant; } });
Object.defineProperty(exports, "suspendTenant", { enumerable: true, get: function () { return tenant_1.suspendTenant; } });
Object.defineProperty(exports, "assignRole", { enumerable: true, get: function () { return tenant_1.assignRole; } });
Object.defineProperty(exports, "createAttendant", { enumerable: true, get: function () { return tenant_1.createAttendant; } });
Object.defineProperty(exports, "pushAnnouncement", { enumerable: true, get: function () { return tenant_1.pushAnnouncement; } });
Object.defineProperty(exports, "getPlatformStats", { enumerable: true, get: function () { return tenant_1.getPlatformStats; } });
// Core parking operations
var parking_1 = require("./parking");
Object.defineProperty(exports, "vehicleEntry", { enumerable: true, get: function () { return parking_1.vehicleEntry; } });
Object.defineProperty(exports, "vehicleExit", { enumerable: true, get: function () { return parking_1.vehicleExit; } });
Object.defineProperty(exports, "startShift", { enumerable: true, get: function () { return parking_1.startShift; } });
Object.defineProperty(exports, "endShift", { enumerable: true, get: function () { return parking_1.endShift; } });
Object.defineProperty(exports, "transactionReceiptHandler", { enumerable: true, get: function () { return parking_1.transactionReceiptHandler; } });
Object.defineProperty(exports, "generateReport", { enumerable: true, get: function () { return parking_1.generateReport; } });
Object.defineProperty(exports, "scheduledAnomalyCheck", { enumerable: true, get: function () { return parking_1.scheduledAnomalyCheck; } });
//# sourceMappingURL=index.js.map