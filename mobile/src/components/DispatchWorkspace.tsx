import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  NoticeBanner,
  Screen,
  SectionTitle,
  SelectField,
} from './ui';
import { DateField } from './DateTimeField';
import { SignatureModal } from './SignatureModal';
import { colors } from '../lib/theme';
import { formatDate, num, todayISO } from '../lib/format';
import type { ApiResponse } from '../types';

interface Customer {
  _id: string;
  name: string;
  code: string;
}

interface FgRow {
  _id: string;
  batchId: string;
  batchNo: string;
  productName: string;
  quantityAvailable: number;
  status: string;
}

interface DispatchRow {
  _id: string;
  batchId: string;
  batchNo: string;
  customerName: string;
  dispatchDate: string;
  billNo: string;
  quantity: number;
  status: string;
}

function dispatchTone(status: string): 'warning' | 'success' | 'grey' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'grey';
}

export default function DispatchWorkspace({ batchId }: { batchId?: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    batchId: batchId ?? '',
    customerId: '',
    dispatchDate: todayISO(),
    billNo: '',
    quantity: '',
  });

  const inventory = useQuery({
    queryKey: ['inventory-fg'],
    queryFn: async () => unwrap(await api.get<ApiResponse<FgRow[]>>('/inventory/finished-goods')),
  });

  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Customer[]>>('/customers')),
  });

  const dispatches = useQuery({
    queryKey: ['dispatches', batchId ?? 'all'],
    queryFn: async () =>
      unwrap(
        await api.get<ApiResponse<DispatchRow[]>>('/dispatches', {
          params: batchId ? { batchId } : undefined,
        }),
      ),
  });

  const availableBatches = useMemo(
    () => (inventory.data ?? []).filter((fg) => fg.quantityAvailable > 0),
    [inventory.data],
  );

  const selectedFg = useMemo(() => {
    const id = form.batchId || batchId || '';
    if (!id) return undefined;
    return (inventory.data ?? []).find((fg) => String(fg.batchId) === id);
  }, [inventory.data, form.batchId, batchId]);

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/dispatches', {
        batchId: form.batchId || batchId,
        customerId: form.customerId,
        dispatchDate: form.dispatchDate,
        billNo: form.billNo.trim(),
        quantity: num(form.quantity, 0),
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setMsg('Dispatch draft created — confirm to decrement inventory');
      setError('');
      setForm((f) => ({ ...f, billNo: '', quantity: '' }));
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to create dispatch')),
  });

  const confirm = useMutation({
    mutationFn: async (body: { id: string; password: string; statement?: string }) => {
      const { data } = await api.post(`/dispatches/${body.id}/confirm`, {
        signature: { password: body.password, statement: body.statement },
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-fg'] });
      void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setMsg('Dispatch confirmed — inventory updated');
      setConfirmId(null);
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/dispatches/${id}/cancel`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setMsg('Draft dispatch cancelled');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to cancel dispatch')),
  });

  const submit = () => {
    setError('');
    setMsg('');
    const id = form.batchId || batchId;
    if (!id) {
      setError('Select a finished-goods batch.');
      return;
    }
    if (!form.customerId) {
      setError('Select a customer.');
      return;
    }
    if (!form.billNo.trim()) {
      setError('Bill no. is required.');
      return;
    }
    const qty = num(form.quantity, 0);
    if (qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (selectedFg && qty > selectedFg.quantityAvailable) {
      setError(
        `Quantity exceeds available stock (${selectedFg.quantityAvailable.toLocaleString()} for ${selectedFg.batchNo}).`,
      );
      return;
    }
    create.mutate();
  };

  const canCreate = hasPermission('dispatch:create');
  const canConfirm = hasPermission('dispatch:confirm');

  return (
    <Screen>
      <Card>
        <SectionTitle>{batchId ? 'Dispatch · this batch' : 'Dispatch'}</SectionTitle>
        <Text style={styles.sub}>
          Customer · bill no. · quantity — confirmed dispatches reduce finished goods stock
        </Text>
      </Card>

      <NoticeBanner message={msg} tone="success" />
      <ErrorBanner message={error} />

      {selectedFg ? (
        <Card style={{ backgroundColor: colors.primaryLight }}>
          <Text style={styles.sub}>
            Available stock for <Text style={styles.strong}>{selectedFg.batchNo}</Text>:{' '}
            <Text style={styles.stockValue}>{selectedFg.quantityAvailable.toLocaleString()}</Text>
          </Text>
        </Card>
      ) : null}

      {canCreate ? (
        <Card>
          <SectionTitle>Create draft dispatch</SectionTitle>
          {inventory.isLoading ? <Loading label="Loading stock…" /> : null}
          {inventory.error ? <ErrorBanner message={apiErrorMessage(inventory.error)} /> : null}
          {!batchId ? (
            <SelectField
              label="Batch (finished goods)"
              value={form.batchId}
              options={availableBatches.map((fg) => ({
                value: fg.batchId,
                label: `${fg.batchNo} (${fg.quantityAvailable.toLocaleString()} available)`,
              }))}
              onChange={(v) => setForm((f) => ({ ...f, batchId: v }))}
              placeholder="Select batch"
            />
          ) : null}
          <SelectField
            label="Customer"
            value={form.customerId}
            options={(customers.data ?? []).map((c) => ({
              value: c._id,
              label: `${c.code} — ${c.name}`,
            }))}
            onChange={(v) => setForm((f) => ({ ...f, customerId: v }))}
            placeholder="Select customer"
          />
          <DateField
            label="Dispatch date"
            value={form.dispatchDate}
            onChange={(v) => setForm((f) => ({ ...f, dispatchDate: v }))}
          />
          <Field label="Bill no." value={form.billNo} onChangeText={(v) => setForm((f) => ({ ...f, billNo: v }))} />
          <Field
            label="Quantity"
            value={form.quantity}
            onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
            keyboardType="numeric"
            placeholder={
              selectedFg ? `${selectedFg.quantityAvailable.toLocaleString()} available` : 'Quantity'
            }
          />
          <Button
            title={create.isPending ? 'Creating…' : 'Create draft dispatch'}
            onPress={submit}
            loading={create.isPending}
          />
        </Card>
      ) : null}

      {dispatches.isLoading ? <Loading label="Loading dispatches…" /> : null}
      {dispatches.error ? <ErrorBanner message={apiErrorMessage(dispatches.error)} /> : null}
      {dispatches.isSuccess && (dispatches.data?.length ?? 0) === 0 ? (
        <EmptyState text="No dispatches yet." />
      ) : null}

      {(dispatches.data ?? []).map((d) => (
        <Card key={d._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{d.billNo}</Text>
            <Badge text={d.status} tone={dispatchTone(d.status)} />
          </View>
          <Text style={styles.sub}>
            {d.batchNo} · {d.customerName}
          </Text>
          <Text style={styles.sub}>
            Qty {d.quantity.toLocaleString()} · {formatDate(d.dispatchDate)}
          </Text>
          {d.status === 'DRAFT' && (canConfirm || canCreate) ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {canConfirm ? (
                <Button title="Confirm" variant="success" onPress={() => setConfirmId(d._id)} />
              ) : null}
              {canCreate ? (
                <Button
                  title="Cancel"
                  variant="danger"
                  onPress={() => cancel.mutate(d._id)}
                  loading={cancel.isPending && cancel.variables === d._id}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}

      <SignatureModal
        visible={!!confirmId}
        title="Confirm Dispatch"
        confirmLabel="Confirm & Deduct Stock"
        statement="I confirm this dispatch quantity and bill details are accurate."
        variant="success"
        onClose={() => setConfirmId(null)}
        onConfirm={async ({ password, statement }) => {
          await confirm.mutateAsync({ id: confirmId as string, password, statement });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  strong: { fontWeight: '700', color: colors.text },
  stockValue: { fontWeight: '800', color: colors.primary, fontSize: 16 },
});
