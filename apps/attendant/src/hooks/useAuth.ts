/**
 * useAuth — Attendant App
 * Phone OTP login. Reads tenantId + assignedLotIds from Custom Claims.
 */

import { useState, useEffect } from 'react';
import {
  signInWithPhoneNumber, signOut as fbSignOut,
  onAuthStateChanged, User,
  ApplicationVerifier, ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export interface AttendantUser extends User {
  role:            string;
  tenantId:        string;
  assignedLotIds:  string[];
  displayFullName: string;
  tenantStatus?:   string;
}

interface UseAuthReturn {
  user:            AttendantUser | null;
  isLoading:       boolean;
  sendOtp:         (phone: string, verifier: ApplicationVerifier) => Promise<ConfirmationResult>;
  verifyOtp:       (confirmation: ConfirmationResult, otp: string) => Promise<void>;
  signOut:         () => Promise<void>;
  error:           string | null;
}

export function useAuth(): UseAuthReturn {
  const [user,      setUser]      = useState<AttendantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token       = await fbUser.getIdTokenResult(true);
          const role        = (token.claims['role'] as string) || '';
          const tenantId    = (token.claims['tenantId'] as string) || '';

          // Fetch profile + tenant status
          const [userDoc, tenantDoc] = await Promise.all([
            getDoc(doc(firestore, 'users', fbUser.uid)),
            tenantId ? getDoc(doc(firestore, 'tenants', tenantId)) : Promise.resolve(null),
          ]);

          const userData = userDoc.data() || {};

          setUser({
            ...fbUser,
            role,
            tenantId,
            assignedLotIds:  userData.assignedLotIds || [],
            displayFullName: userData.name || '',
            tenantStatus:    tenantDoc?.data()?.status,
          } as AttendantUser);
        } catch (e) {
          console.error('Auth load error', e);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const sendOtp = async (phone: string, verifier: ApplicationVerifier) => {
    setError(null);
    const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
    return signInWithPhoneNumber(auth, formatted, verifier);
  };

  const verifyOtp = async (confirmation: ConfirmationResult, otp: string) => {
    setError(null);
    try {
      const cred    = await confirmation.confirm(otp);
      const fbUser  = cred.user;
      const userRef = doc(firestore, 'users', fbUser.uid);
      const exists  = await getDoc(userRef);
      if (!exists.exists()) {
        // First login — create placeholder profile (owner will assign role)
        await setDoc(userRef, {
          uid: fbUser.uid, phone: fbUser.phoneNumber,
          name: '', email: '', role: 'attendant',
          tenantId: '', assignedLotIds: [],
          isActive: true, createdAt: Timestamp.now(),
        });
      }
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-verification-code'
        ? 'Invalid OTP. Please try again.'
        : e.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const signOut = () => fbSignOut(auth);

  return { user, isLoading, sendOtp, verifyOtp, signOut, error };
}
