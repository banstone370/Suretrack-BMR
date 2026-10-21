import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/state/AuthContext';
import { Button, ErrorBanner, Field } from '../src/components/ui';
import { apiErrorMessage } from '../src/lib/api';
import { colors, radius } from '../src/lib/theme';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/(app)/(tabs)');
  }, [ready, user]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      // API origin is resolved in the background (src/lib/api.ts):
      // stored override -> EXPO_PUBLIC_API_URL -> production default.
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      setError(apiErrorMessage(e, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.wrap}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={styles.logo}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>eBMR</Text>
            </View>
            <Text style={styles.title}>SureTech Medical</Text>
            <Text style={styles.subtitle}>Batch Manufacturing Records — Mobile</Text>
          </View>

          <View style={styles.card}>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@suretech.local" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            <ErrorBanner message={error} />
            <Button title="Sign in" onPress={submit} loading={busy} />
            <Text style={styles.hint}>
              Demo logins: admin@suretech.local / Admin@12345 — other roles *@suretech.local / Demo@12345
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 20 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.muted, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: radius, padding: 18, borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
