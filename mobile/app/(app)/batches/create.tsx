import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../../src/lib/api';
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
} from '../../../src/components/ui';
import { DateField } from '../../../src/components/DateTimeField';
import { colors } from '../../../src/lib/theme';
import { todayISO } from '../../../src/lib/format';
import type { ApiResponse, Product } from '../../../src/types';

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setMonth(d.getMonth() + months);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function CreateBatchPage() {
  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Product[]>>('/products')),
  });

  const [productId, setProductId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [batchSize, setBatchSize] = useState('');
  const [mfgDate, setMfgDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => (products.data ?? []).find((p) => p._id === productId),
    [products.data, productId],
  );

  const effectiveExpiry = expiryTouched ? expiryDate : selected ? addMonths(mfgDate, selected.shelfLifeMonths ?? 0) : expiryDate;

  const create = useMutation({
    mutationFn: async () =>
      unwrap(await api.post<ApiResponse<{ id?: string; _id?: string }>>('/batches', {
        productId,
        batchSize: Number(batchSize),
        manufacturingDate: mfgDate,
        expiryDate: effectiveExpiry || undefined,
        batchNo: batchNo.trim() || undefined,
      })),
    onSuccess: (b) => {
      const id = b.id ?? b._id ?? '';
      router.replace({ pathname: '/(app)/batch/[id]', params: { id } } as never);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submit = () => {
    setError('');
    if (!productId) return setError('Please select a product.');
    if (!batchSize || Number(batchSize) <= 0 || !Number.isFinite(Number(batchSize)))
      return setError('Batch size must be a positive number.');
    if (!mfgDate) return setError('Manufacturing date is required.');
    create.mutate();
  };

  if (products.isLoading) return <Loading />;

  return (
    <Screen>
      <Card>
        <SectionTitle>New Batch</SectionTitle>
        <NoticeBanner message="Leave Batch No. empty to auto-generate it from the catalogue prefix and date." tone="info" />
        <SelectField
          label="Product"
          value={productId}
          onChange={(v) => {
            setProductId(v);
            const p = (products.data ?? []).find((x) => x._id === v);
            if (p) {
              setBatchSize(String(p.defaultBatchSize ?? 10000));
              setExpiryTouched(false);
            }
          }}
          options={(products.data ?? []).map((p) => ({ value: p._id, label: `${p.name} (${p.catalogueNo})` }))}
        />
        {selected ? (
          <Text style={styles.meta}>Catalogue No.: {selected.catalogueNo} · Shelf life: {selected.shelfLifeMonths} months</Text>
        ) : null}
        <Field label="Batch No. (optional — auto if blank)" value={batchNo} onChangeText={setBatchNo} />
        <Field label="Batch Size" value={batchSize} onChangeText={setBatchSize} keyboardType="numeric" />
        <DateField label="Manufacturing Date" value={mfgDate} onChange={setMfgDate} />
        <DateField
          label="Expiry Date"
          value={effectiveExpiry}
          onChange={(v) => {
            setExpiryTouched(true);
            setExpiryDate(v);
          }}
        />
        <ErrorBanner message={error} />
        <Button title="Create Batch" onPress={submit} loading={create.isPending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12, marginBottom: 10 },
});
