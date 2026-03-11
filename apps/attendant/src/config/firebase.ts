// Replace ALL placeholder values with your actual Firebase project config.
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage }   from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID",
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
