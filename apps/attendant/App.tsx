/**
 * ParkSmart Attendant App — Root
 * com.utilzone.parking.attendant
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuth }   from './src/hooks/useAuth';
import { firestore } from './src/config/firebase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

function AppInner() {
  const { user } = useAuth();

  // Register FCM token on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (token && user.uid) {
          await updateDoc(doc(firestore, 'users', user.uid), { fcmToken: token });
        }
      } catch { /* non-critical */ }
    })();
  }, [user?.uid]);

  return <RootNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppInner />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
