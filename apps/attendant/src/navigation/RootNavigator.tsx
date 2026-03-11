/**
 * RootNavigator — Attendant App
 *
 * Navigation states:
 *  LOADING     → splash/loading screen
 *  UNAUTHENTICATED → LoginScreen
 *  NO_SHIFT    → ShiftStartScreen (select lot, start shift)
 *  IN_SHIFT    → MainTabs (Entry / Exit / History / Profile)
 */

import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { Text }                        from 'react-native';

import { useAuth }           from '../hooks/useAuth';
import LoginScreen           from '../screens/LoginScreen';
import ShiftStartScreen      from '../screens/ShiftStartScreen';
import VehicleEntryScreen    from '../screens/VehicleEntryScreen';
import VehicleExitScreen     from '../screens/VehicleExitScreen';
import ShiftHistoryScreen    from '../screens/ShiftHistoryScreen';
import ProfileScreen         from '../screens/ProfileScreen';

export interface ActiveShift {
  shiftId: string;
  lot: {
    lotId:         string;
    name:          string;
    city:          string;
    parkingMode:   'slot_based' | 'capacity_based';
    totalCapacity?: number;
    currentCount?:  number;
    allowOverflow?: boolean;
  };
}

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
  );
}

function MainTabs({ activeShift, onEndShift }: { activeShift: ActiveShift; onEndShift: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:     false,
        tabBarStyle:     { backgroundColor: '#0E1420', borderTopColor: '#1E2D45', height: 60 },
        tabBarLabelStyle:{ fontSize: 10, fontWeight: '700', marginBottom: 6 },
        tabBarActiveTintColor:   '#F59E0B',
        tabBarInactiveTintColor: '#3A506B',
      }}
    >
      <Tab.Screen
        name="Entry"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🚗" focused={focused} />, tabBarLabel: 'Entry' }}
      >
        {() => <VehicleEntryScreen shiftId={activeShift.shiftId} activeLot={activeShift.lot} />}
      </Tab.Screen>

      <Tab.Screen
        name="Exit"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🚪" focused={focused} />, tabBarLabel: 'Exit' }}
      >
        {() => <VehicleExitScreen shiftId={activeShift.shiftId} activeLot={activeShift.lot} />}
      </Tab.Screen>

      <Tab.Screen
        name="History"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />, tabBarLabel: 'History' }}
      >
        {() => <ShiftHistoryScreen shiftId={activeShift.shiftId} activeLot={activeShift.lot} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />, tabBarLabel: 'Profile' }}
      >
        {() => <ProfileScreen activeShift={activeShift} onEndShift={onEndShift} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.logo}>⬡ ParkSmart</Text>
        <ActivityIndicator color="#F59E0B" style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (!activeShift) {
    return (
      <ShiftStartScreen
        onShiftStarted={(shiftId, lot) => setActiveShift({ shiftId, lot })}
      />
    );
  }

  return <MainTabs activeShift={activeShift} onEndShift={() => setActiveShift(null)} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1, backgroundColor: '#0A0E1A',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { fontSize: 28, fontWeight: '800', color: '#F59E0B', letterSpacing: 2 },
});
