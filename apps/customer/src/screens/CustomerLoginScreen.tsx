import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';
import app from '../config/firebase';

type Step = 'phone' | 'otp';

export default function CustomerLoginScreen() {
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [step,         setStep]         = useState<Step>('phone');
  const [phone,        setPhone]        = useState('');
  const [otp,          setOtp]          = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const otpRefs = Array.from({ length: 6 }, () => useRef<TextInput>(null));

  const handleSendOtp = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { Alert.alert('Invalid Number', 'Enter a 10-digit mobile number.'); return; }
    setIsLoading(true);
    try {
      const res = await signInWithPhoneNumber(auth, `+91${clean}`, recaptchaRef.current!);
      setConfirmation(res);
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally { setIsLoading(false); }
  };

  const handleVerify = async () => {
    if (!confirmation || otp.length !== 6) return;
    setIsLoading(true);
    try {
      const cred = await confirmation.confirm(otp);
      const u    = cred.user;
      const ref  = doc(firestore, 'users', u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: u.uid, phone: u.phoneNumber, name: '', email: '',
          role: 'customer', isActive: true, createdAt: Timestamp.now(),
        });
      }
    } catch (e: any) {
      Alert.alert('Wrong OTP', 'Please check the code and try again.');
      setOtp('');
    } finally { setIsLoading(false); }
  };

  const handleOtpChar = (char: string, i: number) => {
    const arr = otp.split(''); arr[i] = char;
    const joined = arr.join('').slice(0, 6);
    setOtp(joined);
    if (char && i < 5) otpRefs[i + 1].current?.focus();
  };

  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={app.options} attemptInvisibleVerification />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>⬡ ParkSmart</Text>
        <Text style={styles.tagline}>Your parking, simplified.</Text>

        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <Text style={styles.title}>Enter Your Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.cc}><Text style={styles.ccText}>🇮🇳 +91</Text></View>
                <TextInput style={styles.phoneInput} value={phone} onChangeText={setPhone}
                  placeholder="98XXXXXXXX" placeholderTextColor="#3A506B"
                  keyboardType="number-pad" maxLength={10} autoFocus />
              </View>
              <TouchableOpacity
                style={[styles.btn, (isLoading || phone.length < 10) && styles.btnOff]}
                onPress={handleSendOtp} disabled={isLoading || phone.length < 10}>
                {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>GET OTP →</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.sub}>Sent to +91 {phone}
                <Text style={{ color: '#F59E0B' }} onPress={() => { setStep('phone'); setOtp(''); }}> Change</Text>
              </Text>
              <View style={styles.otpRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TextInput key={i} ref={otpRefs[i]} style={[styles.otpBox, otp[i] && styles.otpFilled]}
                    value={otp[i] || ''} onChangeText={c => handleOtpChar(c.slice(-1), i)}
                    keyboardType="number-pad" maxLength={1} textAlign="center" selectTextOnFocus />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btn, (isLoading || otp.length !== 6) && styles.btnOff]}
                onPress={handleVerify} disabled={isLoading || otp.length !== 6}>
                {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>VERIFY & LOGIN</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={styles.footer}>com.utilzone.parking · v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell:      { flex: 1, backgroundColor: '#0A0E1A' },
  container:  { flexGrow: 1, padding: 28, justifyContent: 'center' },
  logo:       { fontSize: 32, fontWeight: '900', color: '#F59E0B', marginBottom: 4, textAlign: 'center' },
  tagline:    { fontSize: 13, color: '#5A7090', textAlign: 'center', marginBottom: 40 },
  card:       { backgroundColor: '#131B2A', borderRadius: 20, borderWidth: 1, borderColor: '#1E2D45', padding: 24 },
  title:      { fontSize: 18, fontWeight: '800', color: '#F0F4FF', marginBottom: 20 },
  sub:        { fontSize: 13, color: '#5A7090', marginBottom: 20 },
  phoneRow:   { flexDirection: 'row', gap: 10, marginBottom: 20 },
  cc:         { backgroundColor: '#0A0E1A', borderRadius: 12, borderWidth: 1, borderColor: '#1E2D45', paddingHorizontal: 14, justifyContent: 'center' },
  ccText:     { fontSize: 14, fontWeight: '700', color: '#F0F4FF' },
  phoneInput: { flex: 1, backgroundColor: '#0A0E1A', borderRadius: 12, borderWidth: 1.5, borderColor: '#F59E0B', padding: 14, fontSize: 18, color: '#F0F4FF', fontFamily: 'monospace', letterSpacing: 2 },
  otpRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox:     { width: 44, height: 52, backgroundColor: '#0A0E1A', borderRadius: 10, borderWidth: 1.5, borderColor: '#1E2D45', fontSize: 20, fontWeight: '800', color: '#F0F4FF' },
  otpFilled:  { borderColor: '#F59E0B' },
  btn:        { backgroundColor: '#F59E0B', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnOff:     { opacity: 0.35 },
  btnText:    { fontSize: 14, fontWeight: '800', color: '#000' },
  footer:     { marginTop: 32, textAlign: 'center', fontSize: 10, color: '#253550' },
});
