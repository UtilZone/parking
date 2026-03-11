// Replace with your actual Firebase config
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            "AIzaSyCKiPZAlR0CGootibjZoTSMjdUjUvRyYnI",
  authDomain:        "utilzone-parking.firebaseapp.com",
  projectId:         "utilzone-parking",
  storageBucket:     "utilzone-parking.firebasestorage.app",
  messagingSenderId: "1074471029697",
  appId:             "1:1074471029697:web:cccd5913a2c3db2271bd40",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth      = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const firestore = getFirestore(app);
export const functions = getFunctions(app, 'asia-south1');
export default app;
