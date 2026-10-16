import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Screen,
  SectionTitle,
  StatusBadge,
} from '../../src/components/ui';
import { DateField } from '../../src/components/DateTimeField';
import { colors } from '../../src/lib/theme';
import { formatDate, num, todayISO } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

interface Cartridge {
  _id: string;
  cartridgeBatchNo: string;
  manufacturer: string;
  receivedDate: string;
  expiryDate: string;
  quantityGrams: number;
  quantityRemainingGrams: number;
  status: string;
}

export default function EtoCartridgesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cartridgeBatchNo: '',
    manufacturer: '',
    receivedDate: todayISO(),
    expiryDate: '',
    quantityGrams: '40',
  });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['eto-cartridges'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Cartridge[]>>('/eto-cartridges')),
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        cartridgeBatchNo: form.cartridgeBatchNo.trim(),
        manufacturer: form.manufacturer.trim(),
        receivedDate: form.receivedDate,
        expiryDate: form.expiryDate,
        quantityGrams: num(form.quantityGrams, 40),
      };
      return unwrap(await api.post<ApiResponse<Cartridge>>('/eto-cartridges', payload));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['eto-cartridges'] });
      setForm({
        cartridgeBatchNo: '',
        manufacturer: '',
        receivedDate: todayISO(),
        expiryDate: '',
        quantityGrams: '40',
      });
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to create cartridge')),
  });

  const submit = () => {
    setError('');
    if (!form.cartridgeBatchNo.trim() || !form.manufacturer.trim()) {
      setError('Cartridge batch no. and manufacturer are required.');
      return;
    }
    if (!form.receivedDate || !form.expiryDate) {
      setError('Received date and expiry date are required.');
      return;
    }
    if (num(form.quantityGrams, 0) <= 0) {
      setError('Quantity (g) must be greater than zero.');
      return;
    }
    create.mutate();
  };

  const canManage = hasPermission('eto_cartridge:manage');

  return (
    <Screen>
      <Card>
        <SectionTitle>ETO Cartridges</SectionTitle>
        <Text style={styles.sub}>Sterilization gas cartridge inventory &amp; traceability</Text>
        {canManage ? (
          <Button
            title={showForm ? 'Cancel' : 'Add cartridge'}
            variant={showForm ? 'ghost' : 'primary'}
            onPress={() => {
              setShowForm((v) => !v);
              setError('');
            }}
          />
        ) : null}
      </Card>

      {canManage && showForm ? (
        <Card>
          <SectionTitle>New cartridge</SectionTitle>
          <Field
            label="Cartridge batch no."
            value={form.cartridgeBatchNo}
            onChangeText={(v) => setForm((f) => ({ ...f, cartridgeBatchNo: v }))}
          />
          <Field
            label="Manufacturer"
            value={form.manufacturer}
            onChangeText={(v) => setForm((f) => ({ ...f, manufacturer: v }))}
            autoCapitalize="words"
          />
          <Field
            label="Quantity (g)"
            value={form.quantityGrams}
            onChangeText={(v) => setForm((f) => ({ ...f, quantityGrams: v }))}
            keyboardType="numeric"
          />
          <DateField
            label="Received date"
            value={form.receivedDate}
            onChange={(v) => setForm((f) => ({ ...f, receivedDate: v }))}
          />
          <DateField
            label="Expiry date"
            value={form.expiryDate}
            onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
          />
          <ErrorBanner message={error} />
          <Button
            title={create.isPending ? 'Saving…' : 'Add cartridge'}
            variant="success"
            onPress={submit}
            loading={create.isPending}
          />
        </Card>
      ) : null}

      {list.isLoading ? <Loading label="Loading cartridges…" /> : null}
      {list.error ? <ErrorBanner message={apiErrorMessage(list.error)} /> : null}
      {list.isSuccess && (list.data?.length ?? 0) === 0 ? (
        <EmptyState text="No cartridges yet. Run seed or add one above." />
      ) : null}

      {(list.data ?? []).map((c) => {
        const pct =
          c.quantityGrams > 0
            ? Math.max(0, Math.min(100, (c.quantityRemainingGrams / c.quantityGrams) * 100))
            : 0;
        return (
          <Card key={c._id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>{c.cartridgeBatchNo}</Text>
              <StatusBadge status={c.status} />
            </View>
            <Text style={styles.sub}>{c.manufacturer}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dt}>Remaining</Text>
                <Text style={styles.dd}>
                  {c.quantityRemainingGrams}g / {c.quantityGrams}g
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dt}>Received</Text>
                <Text style={styles.dd}>{formatDate(c.receivedDate)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dt}>Expiry</Text>
                <Text style={styles.dd}>{formatDate(c.expiryDate)}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  dt: { fontSize: 11, color: colors.muted },
  dd: { fontSize: 14, fontWeight: '600', color: colors.text },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.greyLight,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
});
