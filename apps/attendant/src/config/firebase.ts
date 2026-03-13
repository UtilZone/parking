// Replace ALL placeholder values with your actual Firebase project config.
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage }   from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            "AIzaSyCKiPZAlR0CGootibjZoTSMjdUjUvRyYnI",
  authDomain:        "utilzone-parking.firebaseapp.com",
  projectId:         "utilzone-parking",
  storageBucket:     "utilzone-parking.appspot.com",
  messagingSenderId: "1074471029697",
  appId:             "1:1074471029697:android:e075094d49d0153b71bd40",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth with AsyncStorage persistence (survives app restarts)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const firestore  = getFirestore(app);
export const storage    = getStorage(app);
export const functions  = getFunctions(app, 'asia-south1');

// Uncomment below ONLY for local emulator development.
// Change LOCAL_IP to your machine's LAN IP when testing on a real device.
//
// if (__DEV__) {
//   const LOCAL_IP = 'YOUR_LAN_IP'; // e.g. '192.168.1.100'
//   connectFirestoreEmulator(firestore, LOCAL_IP, 8080);
//   connectStorageEmulator(storage,     LOCAL_IP, 9199);
//   connectFunctionsEmulator(functions, LOCAL_IP, 5001);
// }

export default app;
