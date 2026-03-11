import { useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut as fbSignOut, User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export interface OwnerUser {
  uid:        string;
  email:      string | null;
  name:       string;
  tenantId:   string;
  role:       string;
  tenantName: string;
  tenantStatus: string;
  plan:       string;
}

export function useOwnerAuth() {
  const [user,      setUser]      = useState<OwnerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token    = await fbUser.getIdTokenResult(true);
          const tenantId = token.claims['tenantId'] as string;
          const role     = token.claims['role'] as string;

          if (role !== 'owner') {
            await fbSignOut(auth);
            setUser(null);
            setIsLoading(false);
            return;
          }

          const [userDoc, tenantDoc] = await Promise.all([
            getDoc(doc(firestore, 'users', fbUser.uid)),
            getDoc(doc(firestore, 'tenants', tenantId)),
          ]);

          setUser({
            uid:          fbUser.uid,
            email:        fbUser.email,
            name:         userDoc.data()?.name || '',
            tenantId,
            role,
            tenantName:   tenantDoc.data()?.businessName || '',
            tenantStatus: tenantDoc.data()?.status || '',
            plan:         tenantDoc.data()?.plan || '',
          });
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const login = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => fbSignOut(auth);

  return { user, isLoading, login, logout };
}
