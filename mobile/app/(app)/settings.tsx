import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Loading,
  NoticeBanner,
  Screen,
  SectionTitle,
  SelectField,
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import type { ApiResponse } from '../../src/types';

interface Settings {
  companyName: string;
  companyAddress: string;
  batchNoPrefixMode: 'CATALOGUE' | 'FIXED';
  fixedBatchPrefix: string;
  esignStatement: string;
  pdfFooterNote: string;
}

const MODE_OPTIONS: Array<{ value: Settings['batchNoPrefixMode']; label: string }> = [
  { value: 'CATALOGUE', label: 'From catalogue (e.g. IN…)' },
  { value: 'FIXED', label: 'Fixed prefix' },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<Settings>({
    companyName: '',
    companyAddress: '',
    batchNoPrefixMode: 'CATALOGUE',
    fixedBatchPrefix: '',
    esignStatement: '',
    pdfFooterNote: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Settings>>('/settings')),
  });

  useEffect(() => {
    if (settings.data) {
      setForm({
        companyName: settings.data.companyName ?? '',
        companyAddress: settings.data.companyAddress ?? '',
        batchNoPrefixMode: settings.data.batchNoPrefixMode ?? 'CATALOGUE',
        fixedBatchPrefix: settings.data.fixedBatchPrefix ?? '',
        esignStatement: settings.data.esignStatement ?? '',
        pdfFooterNote: settings.data.pdfFooterNote ?? '',
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<ApiResponse<Settings>>('/settings', form);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMsg('Settings saved');
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Save failed')),
  });

  const submit = () => {
    setError('');
    setMsg('');
    if (!form.companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (form.batchNoPrefixMode === 'FIXED' && !form.fixedBatchPrefix.trim()) {
      setError('Fixed batch prefix is required in FIXED mode.');
      return;
    }
    save.mutate();
  };

  const canConfigure = hasPermission('system:configure');

  return (
    <Screen>
      <Card>
        <SectionTitle>Settings</SectionTitle>
        <Text style={styles.sub}>Company identity, e-sign statement, and PDF footer</Text>
      </Card>

      {settings.isLoading ? <Loading label="Loading settings…" /> : null}
      {settings.error ? <ErrorBanner message={apiErrorMessage(settings.error)} /> : null}

      {settings.data ? (
        <Card>
          <Field
            label="Company name"
            value={form.companyName}
            onChangeText={(v) => setForm((f) => ({ ...f, companyName: v }))}
            editable={canConfigure}
            autoCapitalize="words"
          />
          <Field
            label="Company address"
            value={form.companyAddress}
            onChangeText={(v) => setForm((f) => ({ ...f, companyAddress: v }))}
            multiline
            editable={canConfigure}
            autoCapitalize="sentences"
          />
          <SelectField
            label="Batch no. prefix mode"
            value={form.batchNoPrefixMode}
            options={MODE_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, batchNoPrefixMode: v }))}
            disabled={!canConfigure}
          />
          {form.batchNoPrefixMode === 'FIXED' ? (
            <Field
              label="Fixed prefix"
              value={form.fixedBatchPrefix}
              onChangeText={(v) => setForm((f) => ({ ...f, fixedBatchPrefix: v }))}
              editable={canConfigure}
            />
          ) : null}
          <Field
            label="Default e-sign statement"
            value={form.esignStatement}
            onChangeText={(v) => setForm((f) => ({ ...f, esignStatement: v }))}
            multiline
            editable={canConfigure}
            autoCapitalize="sentences"
          />
          <Field
            label="PDF footer note"
            value={form.pdfFooterNote}
            onChangeText={(v) => setForm((f) => ({ ...f, pdfFooterNote: v }))}
            multiline
            editable={canConfigure}
            autoCapitalize="sentences"
          />

          <NoticeBanner message={msg} tone="success" />
          <ErrorBanner message={error} />

          {canConfigure ? (
            <Button
              title={save.isPending ? 'Saving…' : 'Save settings'}
              onPress={submit}
              loading={save.isPending}
            />
          ) : (
            <View>
              <Text style={styles.hint}>You need the “system:configure” permission to save settings.</Text>
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
