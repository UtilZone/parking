/**
 * LoginScreen — Attendant App
 * Email + password login (attendants are pre-registered by owners)
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { login, error } = useAuth();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Login Failed',
        e.code === 'auth/wrong-password'   ? 'Incorrect password.' :
        e.code === 'auth/user-not-found'   ? 'No account found with this email.' :
        e.code === 'auth/invalid-email'    ? 'Invalid email address.' :
        e.message || 'Login failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Brand */}
        <View style={styles.brandRow}>
          <Text style={styles.brandIcon}>⬡</Text>
          <Text style={styles.brandName}>ParkSmart</Text>
        </View>
        <Text style={styles.subtitle}>Attendant Portal</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>
            Use the credentials provided by your parking lot manager.
          </Text>

          {/* Email */}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="attendant@business.com"
            placeholderTextColor="#3A506B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#3A506B"
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(p => !p)}>
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, (isLoading || !email || !password) && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
          >
            {isLoading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>SIGN IN →</Text>
            }
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Contact your lot manager if you don't have credentials.
          </Text>
        </View>

        <Text style={styles.footer}>com.utilzone.parking · Attendant v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell:      { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { flexGrow: 1, padding: 28, justifyContent: 'center' },

  brandRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  brandIcon:  { fontSize: 32, color: '#F59E0B' },
  brandName:  { fontSize: 30, fontWeight: '900', color: '#F0F4FF', letterSpacing: -1 },
  subtitle:   { fontSize: 13, color: '#5A7090', marginBottom: 40, letterSpacing: 1 },

  card:       { backgroundColor: '#131B2A', borderRadius: 20, borderWidth: 1,
                borderColor: '#1E2D45', padding: 24 },
  cardTitle:  { fontSize: 18, fontWeight: '800', color: '#F0F4FF', marginBottom: 6 },
  cardSub:    { fontSize: 13, color: '#5A7090', marginBottom: 24, lineHeight: 20 },

  fieldLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#5A7090',
                textTransform: 'uppercase', marginBottom: 6 },
  input:      { backgroundColor: '#0A0E1A', borderRadius: 12, borderWidth: 1.5,
                borderColor: '#1E2D45', padding: 14, fontSize: 15, color: '#F0F4FF',
                marginBottom: 16 },
  passRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  eyeBtn:     { padding: 14, backgroundColor: '#0A0E1A', borderRadius: 12,
                borderWidth: 1.5, borderColor: '#1E2D45' },
  eyeText:    { fontSize: 16 },

  primaryBtn:     { backgroundColor: '#F59E0B', borderRadius: 12, padding: 15,
                    alignItems: 'center', marginTop: 4 },
  btnDisabled:    { opacity: 0.35 },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  helpText:  { marginTop: 16, fontSize: 12, color: '#3A506B', textAlign: 'center', lineHeight: 18 },
  errorText: { marginTop: 8, marginBottom: 8, fontSize: 12, color: '#EF4444', textAlign: 'center' },
  footer:    { marginTop: 40, textAlign: 'center', fontSize: 10, color: '#253550' },
});
