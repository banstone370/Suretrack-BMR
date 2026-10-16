import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Screen,
  SectionTitle,
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import type { ApiResponse } from '../../src/types';

interface Customer {
  _id: string;
  name: string;
  code: string;
  address?: string;
  contact?: string;
  isActive: boolean;
}

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', contact: '' });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['customers'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Customer[]>>('/customers')),
  });

  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.post<ApiResponse<Customer>>('/customers', {
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim() || undefined,
          contact: form.contact.trim() || undefined,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setForm({ name: '', code: '', address: '', contact: '' });
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to create customer')),
  });

  const submit = () => {
    setError('');
    if (!form.name.trim() || !form.code.trim()) {
      setError('Customer name and code are required.');
      return;
    }
    create.mutate();
  };

  const canCreate = hasPermission('dispatch:create');

  return (
    <Screen>
      <Card>
        <SectionTitle>Customers</SectionTitle>
        <Text style={styles.sub}>Dispatch customers / consignees</Text>
        {canCreate ? (
          <Button
            title={showForm ? 'Cancel' : 'Add customer'}
            variant={showForm ? 'ghost' : 'primary'}
            onPress={() => {
              setShowForm((v) => !v);
              setError('');
            }}
          />
        ) : null}
      </Card>

      {canCreate && showForm ? (
        <Card>
          <SectionTitle>New customer</SectionTitle>
          <Field label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
          <Field label="Code" value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v }))} />
          <Field label="Address" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} multiline autoCapitalize="sentences" />
          <Field label="Contact" value={form.contact} onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))} />
          <ErrorBanner message={error} />
          <Button
            title={create.isPending ? 'Saving…' : 'Add customer'}
            variant="success"
            onPress={submit}
            loading={create.isPending}
          />
        </Card>
      ) : null}

      {list.isLoading ? <Loading label="Loading customers…" /> : null}
      {list.error ? <ErrorBanner message={apiErrorMessage(list.error)} /> : null}
      {list.isSuccess && (list.data?.length ?? 0) === 0 ? (
        <EmptyState text="No customers yet." />
      ) : null}

      {(list.data ?? []).map((c) => (
        <Card key={c._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{c.name}</Text>
            <Badge text={c.isActive ? 'Active' : 'Inactive'} tone={c.isActive ? 'success' : 'grey'} />
          </View>
          <Text style={styles.sub}>Code: {c.code}</Text>
          {c.contact ? <Text style={styles.sub}>Contact: {c.contact}</Text> : null}
          {c.address ? <Text style={styles.sub}>Address: {c.address}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
