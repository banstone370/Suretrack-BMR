import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  apiErrorMessage,
  arrayBufferToBase64,
  downloadBlob,
  getApiOrigin,
  tokenStore,
  unwrap,
} from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';
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
} from '../../src/components/ui';
import { DateField } from '../../src/components/DateTimeField';
import { colors } from '../../src/lib/theme';
import { formatDate, todayISO } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

type SopStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED';

interface Sop {
  _id: string;
  sopNo: string;
  title: string;
  version: string;
  effectiveDate: string;
  status: string;
  description?: string;
  documentUrl?: string;
}

const STATUS_OPTIONS: Array<{ value: SopStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUPERSEDED', label: 'Superseded' },
];

function sopTone(status: string): 'info' | 'success' | 'grey' {
  if (status === 'APPROVED') return 'success';
  if (status === 'DRAFT') return 'info';
  return 'grey';
}

/** documentUrl may be absolute (http(s)://host/api/v1/...) or already '/api/v1/...' */
function toDownloadPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/i, '');
}

export default function SopsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sopNo: '',
    title: '',
    version: '1.0',
    effectiveDate: todayISO(),
    description: '',
    status: 'APPROVED' as SopStatus,
  });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // extension per SOP remembered from the last upload in this session
  const [extById, setExtById] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ['sops'],
    queryFn: async () => unwrap(await api.get<ApiResponse<Sop[]>>('/sops')),
  });

  const create = useMutation({
    mutationFn: async () =>
      unwrap(await api.post<ApiResponse<Sop>>('/sops', { ...form, sopNo: form.sopNo.trim(), title: form.title.trim() })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sops'] });
      setForm({
        sopNo: '',
        title: '',
        version: '1.0',
        effectiveDate: todayISO(),
        description: '',
        status: 'APPROVED',
      });
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to create SOP')),
  });

  const submit = () => {
    setError('');
    if (!form.sopNo.trim() || !form.title.trim()) {
      setError('SOP no. and title are required.');
      return;
    }
    if (!form.version.trim() || !form.effectiveDate) {
      setError('Version and effective date are required.');
      return;
    }
    create.mutate();
  };

  const uploadDocument = async (sop: Sop) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
      ],
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const origin = await getApiOrigin();
      const token = await tokenStore.getAccess();
      const fd = new FormData();
      fd.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      await axios.post(`${origin}/api/v1/sops/${sop._id}/document`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      const ext = (asset.name.split('.').pop() ?? 'pdf').toLowerCase();
      setExtById((m) => ({ ...m, [sop._id]: ext }));
      void queryClient.invalidateQueries({ queryKey: ['sops'] });
      setMsg(`Document uploaded for ${sop.sopNo}`);
    } catch (e) {
      setError(apiErrorMessage(e, 'Document upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (sop: Sop) => {
    if (!sop.documentUrl) return;
    setError('');
    try {
      const buf = await downloadBlob(toDownloadPath(sop.documentUrl));
      const ext = extById[sop._id] ?? 'pdf';
      const name = `${sop.sopNo.replace(/[^a-zA-Z0-9._-]/g, '_')}_${sop.version}.${ext}`;
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      file.write(arrayBufferToBase64(buf), { encoding: 'base64' });
      try {
        await file.preview({ title: `${sop.sopNo} — ${sop.title}` });
      } catch {
        setMsg(`Saved to ${file.uri}`);
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to open document'));
    }
  };

  const canManage = hasPermission('sops:manage');

  return (
    <Screen>
      <Card>
        <SectionTitle>SOPs</SectionTitle>
        <Text style={styles.sub}>Controlled procedures referenced by batch process templates</Text>
        {canManage ? (
          <Button
            title={showForm ? 'Cancel' : 'Add SOP'}
            variant={showForm ? 'ghost' : 'primary'}
            onPress={() => {
              setShowForm((v) => !v);
              setError('');
            }}
          />
        ) : null}
      </Card>

      <NoticeBanner message={msg} tone="success" />

      {canManage && showForm ? (
        <Card>
          <SectionTitle>New SOP</SectionTitle>
          <Field label="SOP No." value={form.sopNo} onChangeText={(v) => setForm((f) => ({ ...f, sopNo: v }))} placeholder="SOP/MF/008" />
          <Field label="Title" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} autoCapitalize="words" />
          <Field label="Version" value={form.version} onChangeText={(v) => setForm((f) => ({ ...f, version: v }))} />
          <DateField
            label="Effective date"
            value={form.effectiveDate}
            onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
          />
          <SelectField
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <Field label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline autoCapitalize="sentences" />
          <ErrorBanner message={error} />
          <Button
            title={create.isPending ? 'Saving…' : 'Add SOP'}
            variant="success"
            onPress={submit}
            loading={create.isPending}
          />
        </Card>
      ) : null}

      {list.isLoading ? <Loading label="Loading SOPs…" /> : null}
      {list.error ? <ErrorBanner message={apiErrorMessage(list.error)} /> : null}
      {list.isSuccess && (list.data?.length ?? 0) === 0 ? (
        <EmptyState text="No SOPs yet." />
      ) : null}

      {(list.data ?? []).map((sop) => (
        <Card key={sop._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{sop.sopNo}</Text>
            <Badge text={sop.status} tone={sopTone(sop.status)} />
          </View>
          <Text style={styles.strong}>{sop.title}</Text>
          {sop.description ? <Text style={styles.sub}>{sop.description}</Text> : null}
          <Text style={styles.sub}>
            Version {sop.version} · Effective {formatDate(sop.effectiveDate)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {sop.documentUrl ? (
              <View style={{ flex: 1 }}>
                <Button title="Open document" variant="secondary" onPress={() => void openDocument(sop)} disabled={busy} />
              </View>
            ) : (
              <Text style={styles.sub}>No file</Text>
            )}
            {canManage ? (
              <View style={{ flex: 1 }}>
                <Button title="Upload" variant="ghost" onPress={() => void uploadDocument(sop)} loading={busy} />
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  strong: { fontWeight: '600', color: colors.text, fontSize: 14, marginTop: 3 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
