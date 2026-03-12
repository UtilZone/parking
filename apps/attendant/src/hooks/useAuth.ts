/**
 * useAuth — Attendant App
 * Email + password login. Reads tenantId + assignedLotIds from Custom Claims.
 */

import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged, User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export interface AttendantUser extends User {
  role:            string;
  tenantId:        string;
  assignedLotIds:  string[];
  displayFullName: string;
  tenantStatus?:   string;
}

interface UseAuthReturn {
  user:      AttendantUser | null;
  isLoading: boolean;
  login:     (email: string, password: string) => Promise<void>;
  signOut:   () => Promise<void>;
  error:     string | null;
}

export function useAuth(): UseAuthReturn {
  const [user,      setUser]      = useState<AttendantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token    = await fbUser.getIdTokenResult(true);
          const role     = (token.claims['role'] as string) || '';
          const tenantId = (token.claims['tenantId'] as string) || '';

          if (role !== 'attendant') {
            await fbSignOut(auth);
            setUser(null);
            setError('This app is for attendants only.');
            setIsLoading(false);
            return;
          }

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
            displayFullName: userData.name || fbUser.email || '',
            tenantStatus:    (tenantDoc as any)?.data()?.status,
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

  const login = async (email: string, password: string) => {
    setError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => fbSignOut(auth);

  return { user, isLoading, login, signOut, error };
}
