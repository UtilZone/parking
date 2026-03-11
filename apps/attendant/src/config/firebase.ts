// Replace ALL placeholder values with your actual Firebase project config.
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage,   connectStorageEmulator }   from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator }  from 'firebase/functions';
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

// Connect to local emulators in development
if (__DEV__) {
  const LOCAL_IP = 'localhost'; // use your machine's LAN IP on a real device
  connectFirestoreEmulator(firestore, LOCAL_IP, 8080);
  connectStorageEmulator(storage,     LOCAL_IP, 9199);
  connectFunctionsEmulator(functions, LOCAL_IP, 5001);
}

export default app;
