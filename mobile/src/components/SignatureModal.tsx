import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { Button, ErrorBanner, Field } from './ui';
import { colors, radius } from '../lib/theme';
import { formatDateTime } from '../lib/format';

export interface SignaturePayload {
  password: string;
  statement: string;
  reason?: string;
}

export const DEFAULT_ESIGN_STATEMENT =
  'I confirm that I have reviewed this record and the entries are accurate.';

export function SignatureModal({
  visible,
  title,
  confirmLabel = 'Sign & Confirm',
  statement = DEFAULT_ESIGN_STATEMENT,
  requireReason,
  reasonLabel = 'Reason',
  variant = 'primary',
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  confirmLabel?: string;
  statement?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  variant?: 'primary' | 'danger' | 'success';
  onClose: () => void;
  onConfirm: (sig: SignaturePayload) => Promise<void>;
}) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) {
      setError('Password is required for the electronic signature.');
      return;
    }
    if (requireReason && !reason.trim()) {
      setError(`${reasonLabel} is required.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm({ password, statement, reason: reason.trim() || undefined });
      setPassword('');
      setReason('');
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{title}</Text>
            <View style={styles.userCard}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userMeta}>
                {user?.employeeId} · {formatDateTime(new Date())}
              </Text>
            </View>
            <Text style={styles.statement}>{statement}</Text>
            {requireReason ? (
              <Field label={reasonLabel} value={reason} onChangeText={setReason} multiline placeholder="Required reason" />
            ) : (
              <Field label={`${reasonLabel} (optional)`} value={reason} onChangeText={setReason} multiline />
            )}
            <Field
              label="Password / PIN (electronic signature)"
              value={password}
              onChangeText={setPassword}
              placeholder="Your login password is verified by the server"
              secureTextEntry
            />
            <ErrorBanner message={error} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Cancel" variant="ghost" onPress={onClose} />
              <Button title={confirmLabel} variant={variant} onPress={submit} loading={busy} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export async function fetchEsignStatement(): Promise<string> {
  try {
    const { data } = await api.get<{ data: { esignStatement?: string } }>('/settings');
    return data.data?.esignStatement || DEFAULT_ESIGN_STATEMENT;
  } catch {
    return DEFAULT_ESIGN_STATEMENT;
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  userCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius,
    padding: 10,
    marginBottom: 10,
  },
  userName: { fontWeight: '700', color: colors.text, fontSize: 15 },
  userMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statement: { color: colors.muted, fontSize: 13, marginBottom: 12, fontStyle: 'italic' },
});
