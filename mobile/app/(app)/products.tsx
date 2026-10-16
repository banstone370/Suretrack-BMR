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
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import type { ApiResponse, Product } from '../../src/types';

const EMPTY_FORM = {
  name: '',
  catalogueNo: '',
  description: '',
  defaultBatchSize: '10000',
  shelfLifeMonths: '60',
  sealingTemperatureC: '200',
  sealingSopRef: 'SOP/MF/011',
  sterilizationTemperatureC: '55',
  sterilizationDurationHours: '4',
  etoCartridgeGrams: '40',
  sterilizationSopRef: 'SOP/MF/008',
  sterilitySop: 'SOP/QC/004',
  betSop: 'SOP/QC/005',
  storageCondition: 'Store at Room Temperature',
  rmQcChecks:
    'Hub checking\nBevel checking\nGuide wire passing\nVisual inspection for dust, burrs and foreign particles',
  ipqcChecks: 'Dust free\nBurr free\nForeign particle free',
};

type FormKey = keyof typeof EMPTY_FORM;

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function templateOf(product: Product) {
  const t = product.processTemplateId;
  return typeof t === 'object' && t ? t : null;
}

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Product[]>>('/products')),
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        catalogueNo: form.catalogueNo.trim(),
        description: form.description.trim() || undefined,
        defaultBatchSize: Number(form.defaultBatchSize),
        shelfLifeMonths: Number(form.shelfLifeMonths),
        processTemplate: {
          sealingTemperatureC: Number(form.sealingTemperatureC),
          sealingSopRef: form.sealingSopRef.trim(),
          sterilizationTemperatureC: Number(form.sterilizationTemperatureC),
          sterilizationDurationHours: Number(form.sterilizationDurationHours),
          etoCartridgeGrams: Number(form.etoCartridgeGrams),
          sterilizationSopRef: form.sterilizationSopRef.trim(),
          sterilitySop: form.sterilitySop.trim(),
          betSop: form.betSop.trim(),
          storageCondition: form.storageCondition.trim(),
          rmQcChecks: parseLines(form.rmQcChecks),
          ipqcChecks: parseLines(form.ipqcChecks),
        },
      };
      return unwrap(await api.post<ApiResponse<Product>>('/products', payload));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to create product')),
  });

  const setField = (key: FormKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    if (!form.name.trim() || !form.catalogueNo.trim()) {
      setError('Product name and catalogue no. are required.');
      return;
    }
    if (!Number(form.defaultBatchSize) || !Number(form.shelfLifeMonths)) {
      setError('Batch size and shelf life must be numbers greater than zero.');
      return;
    }
    create.mutate();
  };

  const canManage = hasPermission('products:manage');

  return (
    <Screen>
      <Card>
        <SectionTitle>Products</SectionTitle>
        <Text style={styles.sub}>Product masters and BMR process templates</Text>
        {canManage ? (
          <Button
            title={showForm ? 'Cancel' : 'Add Product'}
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
          <SectionTitle>Product details</SectionTitle>
          <Field label="Product name" value={form.name} onChangeText={(v) => setField('name', v)} placeholder="e.g. INTRODUCER NEEDLE" autoCapitalize="words" />
          <Field label="Catalogue No." value={form.catalogueNo} onChangeText={(v) => setField('catalogueNo', v)} placeholder="e.g. IN-002" />
          <Field label="Description" value={form.description} onChangeText={(v) => setField('description', v)} multiline />
          <Field label="Default batch size" value={form.defaultBatchSize} onChangeText={(v) => setField('defaultBatchSize', v)} keyboardType="numeric" />
          <Field label="Shelf life (months)" value={form.shelfLifeMonths} onChangeText={(v) => setField('shelfLifeMonths', v)} keyboardType="numeric" />

          <SectionTitle>Process template</SectionTitle>
          <Text style={styles.sub}>Parameters are snapshotted onto each new batch for this product.</Text>
          <Field label="Sealing temp (°C)" value={form.sealingTemperatureC} onChangeText={(v) => setField('sealingTemperatureC', v)} keyboardType="numeric" />
          <Field label="Sealing SOP" value={form.sealingSopRef} onChangeText={(v) => setField('sealingSopRef', v)} />
          <Field label="ETO temp (°C)" value={form.sterilizationTemperatureC} onChangeText={(v) => setField('sterilizationTemperatureC', v)} keyboardType="numeric" />
          <Field label="ETO duration (hours)" value={form.sterilizationDurationHours} onChangeText={(v) => setField('sterilizationDurationHours', v)} keyboardType="decimal-pad" />
          <Field label="ETO cartridge (g)" value={form.etoCartridgeGrams} onChangeText={(v) => setField('etoCartridgeGrams', v)} keyboardType="numeric" />
          <Field label="Sterilization SOP" value={form.sterilizationSopRef} onChangeText={(v) => setField('sterilizationSopRef', v)} />
          <Field label="Sterility SOP" value={form.sterilitySop} onChangeText={(v) => setField('sterilitySop', v)} />
          <Field label="BET SOP" value={form.betSop} onChangeText={(v) => setField('betSop', v)} />
          <Field label="Storage condition" value={form.storageCondition} onChangeText={(v) => setField('storageCondition', v)} autoCapitalize="words" />
          <Field label="RM QC checks (one per line)" value={form.rmQcChecks} onChangeText={(v) => setField('rmQcChecks', v)} multiline autoCapitalize="sentences" />
          <Field label="In-process QC checks (one per line)" value={form.ipqcChecks} onChangeText={(v) => setField('ipqcChecks', v)} multiline autoCapitalize="sentences" />

          <ErrorBanner message={error} />
          <Button
            title={create.isPending ? 'Saving…' : 'Save product'}
            variant="success"
            onPress={submit}
            loading={create.isPending}
          />
        </Card>
      ) : null}

      {products.isLoading ? <Loading label="Loading products…" /> : null}
      {products.error ? <ErrorBanner message={apiErrorMessage(products.error)} /> : null}
      {products.isSuccess && (products.data?.length ?? 0) === 0 ? (
        <EmptyState text="No products yet. Add the first product." />
      ) : null}

      {(products.data ?? []).map((product) => {
        const template = templateOf(product);
        return (
          <Card key={product._id}>
            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.sub}>Catalogue: {product.catalogueNo}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dt}>Default batch size</Text>
                <Text style={styles.dd}>{product.defaultBatchSize?.toLocaleString() ?? '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dt}>Shelf life</Text>
                <Text style={styles.dd}>{product.shelfLifeMonths} months</Text>
              </View>
            </View>
            {product.description ? <Text style={styles.sub}>{product.description}</Text> : null}
            {template ? (
              <View style={styles.templateBox}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.sub}>
                  Seal {template.sealingParams?.temperatureC ?? '—'}°C · SOP{' '}
                  {template.sealingParams?.sopRef ?? '—'}
                </Text>
                <Text style={styles.sub}>
                  ETO {template.sterilizationParams?.temperatureC ?? '—'}°C /{' '}
                  {template.sterilizationParams?.durationHours ?? '—'}h /{' '}
                  {template.sterilizationParams?.etoCartridgeGrams ?? '—'}g · SOP{' '}
                  {template.sterilizationParams?.sopRef ?? '—'}
                </Text>
                <Text style={styles.sub}>
                  Storage: {template.storageCondition ?? 'Store at Room Temperature'}
                </Text>
              </View>
            ) : null}
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
  templateBox: {
    marginTop: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    padding: 10,
  },
  templateName: { fontWeight: '700', color: colors.text, fontSize: 13 },
});
