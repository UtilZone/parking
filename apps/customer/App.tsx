import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './src/config/firebase';
import * as Notifications from 'expo-notifications';

import CustomerLoginScreen  from './src/screens/CustomerLoginScreen';
import ActiveTokenScreen    from './src/screens/ActiveTokenScreen';
import ParkingHistoryScreen from './src/screens/ParkingHistoryScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0E1420', borderTopColor: '#1E2D45', height: 60 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 6 },
      tabBarActiveTintColor: '#F59E0B',
      tabBarInactiveTintColor: '#3A506B',
    }}>
      <Tab.Screen name="Token"   component={ActiveTokenScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🎫" focused={focused} />, tabBarLabel: 'My Token' }} />
      <Tab.Screen name="History" component={ParkingHistoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />, tabBarLabel: 'History' }} />
      <Tab.Screen name="Profile" component={CustomerProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />, tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsLoading(false);
      if (u) {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(firestore, 'users', u.uid), { fcmToken: token });
          }
        } catch { /* non-critical */ }
      }
    });
    return unsub;
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.logo}>⬡ ParkSmart</Text>
        <ActivityIndicator color="#F59E0B" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          {user ? <MainTabs /> : (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Login" component={CustomerLoginScreen} />
            </Stack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0A0E1A', alignItems: 'center', justifyContent: 'center' },
  logo:    { fontSize: 28, fontWeight: '800', color: '#F59E0B', letterSpacing: 2 },
});
