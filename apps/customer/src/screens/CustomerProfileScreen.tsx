import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export default function CustomerProfileScreen() {
  const user = auth.currentUser;
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(firestore, 'users', user.uid)).then(d => {
      if (d.exists()) { setName(d.data().name || ''); setEmail(d.data().email || ''); }
    });
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { name, email });
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch { Alert.alert('Error', 'Could not save profile.'); }
    finally { setIsSaving(false); }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <Text style={styles.phoneLabel}>{user?.phoneNumber}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>FULL NAME</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#3A506B" />
        <Text style={styles.label}>EMAIL (OPTIONAL)</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor="#3A506B" keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>com.utilzone.parking · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#0A0E1A' },
  container:    { padding: 24, paddingBottom: 40, alignItems: 'center' },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1E2D45',
                  borderWidth: 2, borderColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  avatarText:   { fontSize: 30, fontWeight: '800', color: '#F59E0B' },
  phoneLabel:   { fontSize: 14, color: '#5A7090', fontFamily: 'monospace', marginBottom: 28 },
  section:      { width: '100%', backgroundColor: '#131B2A', borderRadius: 16, borderWidth: 1, borderColor: '#1E2D45', padding: 20, marginBottom: 20 },
  label:        { fontSize: 10, fontWeight: '700', color: '#5A7090', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
  input:        { backgroundColor: '#0A0E1A', borderRadius: 10, borderWidth: 1, borderColor: '#1E2D45', padding: 13, fontSize: 14, color: '#F0F4FF' },
  saveBtn:      { marginTop: 20, backgroundColor: '#F59E0B', borderRadius: 10, padding: 13, alignItems: 'center' },
  saveBtnText:  { fontSize: 13, fontWeight: '800', color: '#000' },
  signOutBtn:   { width: '100%', backgroundColor: '#131B2A', borderRadius: 12, borderWidth: 1, borderColor: '#1E2D45', padding: 14, alignItems: 'center' },
  signOutText:  { fontSize: 14, fontWeight: '700', color: '#5A7090' },
  version:      { marginTop: 24, fontSize: 10, color: '#253550' },
});
