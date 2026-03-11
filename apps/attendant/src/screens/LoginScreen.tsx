/**
 * LoginScreen — Attendant App
 * Phone number → OTP verification → custom claims loaded
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { ConfirmationResult }             from 'firebase/auth';
import { useAuth }                        from '../hooks/useAuth';
import app                                from '../config/firebase';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const { sendOtp, verifyOtp, error } = useAuth();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [step,         setStep]         = useState<Step>('phone');
  const [phone,        setPhone]        = useState('');
  const [otp,          setOtp]          = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const otpRefs       = Array.from({ length: 6 }, () => useRef<TextInput>(null));

  const handleSendOtp = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!recaptchaRef.current) return;

    setIsLoading(true);
    try {
      const result = await sendOtp(clean, recaptchaRef.current);
      setConfirmation(result);
      setStep('otp');
    } catch (e: any) {
      Alert.alert('OTP Failed', e.message || 'Could not send OTP. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || !confirmation) return;
    setIsLoading(true);
    try {
      await verifyOtp(confirmation, otp);
      // Auth state change handled by useAuth → RootNavigator re-renders
    } catch (e: any) {
      Alert.alert('Wrong OTP', e.message || 'Verification failed.');
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP box input handler
  const handleOtpChar = (char: string, index: number) => {
    const arr = otp.split('');
    arr[index] = char;
    const joined = arr.join('').slice(0, 6);
    setOtp(joined);
    if (char && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handleOtpBackspace = (index: number) => {
    if (index > 0 && !otp[index]) otpRefs[index - 1].current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={app.options}
        attemptInvisibleVerification
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Brand */}
        <View style={styles.brandRow}>
          <Text style={styles.brandIcon}>⬡</Text>
          <Text style={styles.brandName}>ParkSmart</Text>
        </View>
        <Text style={styles.subtitle}>Attendant Portal</Text>

        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <Text style={styles.cardTitle}>Enter Mobile Number</Text>
              <Text style={styles.cardSub}>
                We'll send a verification code to confirm your identity.
              </Text>

              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor="#3A506B"
                  keyboardType="number-pad"
                  maxLength={10}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (isLoading || phone.replace(/\D/g,'').length < 10) && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading || phone.replace(/\D/g,'').length < 10}
              >
                {isLoading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.primaryBtnText}>SEND OTP →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSub}>
                Sent to +91 {phone}{' '}
                <Text style={styles.changeLink} onPress={() => { setStep('phone'); setOtp(''); }}>
                  Change
                </Text>
              </Text>

              <View style={styles.otpRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TextInput
                    key={i}
                    ref={otpRefs[i]}
                    style={[styles.otpBox, otp[i] ? styles.otpBoxFilled : null]}
                    value={otp[i] || ''}
                    onChangeText={char => handleOtpChar(char.slice(-1), i)}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace') handleOtpBackspace(i);
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (isLoading || otp.length !== 6) && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.primaryBtnText}>VERIFY & LOGIN</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('phone'); setOtp(''); }}>
                <Text style={styles.resendBtnText}>Resend OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
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

  phoneRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  countryCode:    { backgroundColor: '#0A0E1A', borderRadius: 12, borderWidth: 1,
                    borderColor: '#1E2D45', paddingHorizontal: 14, justifyContent: 'center' },
  countryCodeText:{ fontSize: 14, fontWeight: '700', color: '#F0F4FF' },
  phoneInput:     { flex: 1, backgroundColor: '#0A0E1A', borderRadius: 12, borderWidth: 1.5,
                    borderColor: '#F59E0B', padding: 14, fontSize: 18, color: '#F0F4FF',
                    fontFamily: 'monospace', letterSpacing: 2 },

  otpRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox:     { width: 44, height: 52, backgroundColor: '#0A0E1A', borderRadius: 10,
                borderWidth: 1.5, borderColor: '#1E2D45', fontSize: 20, fontWeight: '800',
                color: '#F0F4FF' },
  otpBoxFilled:{ borderColor: '#F59E0B' },

  primaryBtn:     { backgroundColor: '#F59E0B', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled:    { opacity: 0.35 },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  changeLink:   { color: '#F59E0B', fontWeight: '700' },
  resendBtn:    { marginTop: 14, alignItems: 'center' },
  resendBtnText:{ fontSize: 13, color: '#5A7090' },

  errorText: { marginTop: 14, fontSize: 12, color: '#EF4444', textAlign: 'center' },
  footer:    { marginTop: 40, textAlign: 'center', fontSize: 10, color: '#253550' },
});
