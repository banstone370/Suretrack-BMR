import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorBanner, Field } from './ui';
import { colors } from '../lib/theme';

export default function ReasonModal({
  visible,
  title,
  confirmLabel = 'Confirm',
  variant = 'primary',
  reasonLabel = 'Reason',
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  confirmLabel?: string;
  variant?: 'primary' | 'danger' | 'success';
  reasonLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      setError(`${reasonLabel} is required.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Field label={reasonLabel} value={reason} onChangeText={setReason} multiline />
          <ErrorBanner message={error} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title={confirmLabel} variant={variant} onPress={submit} loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  title: { fontSize: 17, fontWeight: '700', color: colors.primary, marginBottom: 10 },
});
