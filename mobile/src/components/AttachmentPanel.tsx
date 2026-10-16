import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { api, apiErrorMessage, arrayBufferToBase64, getApiOrigin, tokenStore } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, NoticeBanner, SectionTitle } from './ui';
import { colors } from '../lib/theme';
import { formatDateTime } from '../lib/format';

interface Attachment {
  _id: string;
  originalName: string;
  mimeType?: string;
  sizeBytes?: number;
  stageSlug?: string;
  createdAt: string;
}

export default function AttachmentPanel({
  batchId,
  stageSlug,
  canUpload,
}: {
  batchId: string;
  stageSlug?: string;
  canUpload: boolean;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ['attachments', batchId, stageSlug],
    queryFn: async () => {
      const { data } = await api.get<{ data: Attachment[] }>(
        `/batches/${batchId}/attachments`,
        { params: stageSlug ? { stageSlug } : {} },
      );
      return data.data;
    },
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['attachments', batchId] });

  const upload = async (asset: { uri: string; name: string; type: string }) => {
    setBusy(true);
    setError('');
    try {
      const origin = await getApiOrigin();
      const token = await tokenStore.getAccess();
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.type,
      } as unknown as Blob);
      if (stageSlug) form.append('stageSlug', stageSlug);
      await axios.post(`${origin}/api/v1/batches/${batchId}/attachments`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Media library permission is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const name = a.fileName ?? `image-${Date.now()}.jpg`;
    await upload({ uri: a.uri, name, type: a.mimeType ?? 'image/jpeg' });
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is required.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await upload({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' });
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'image/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await upload({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' });
  };

  const open = async (att: Attachment) => {
    setError('');
    try {
      const origin = await getApiOrigin();
      const token = await tokenStore.getAccess();
      const res = await axios.get(`${origin}/api/v1/attachments/${att._id}/download`, {
        responseType: 'arraybuffer',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const ext = (att.originalName.split('.').pop() ?? 'bin').toLowerCase();
      const file = new File(Paths.cache, `${Date.now()}-${att.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      const base64 = arrayBufferToBase64(res.data as ArrayBuffer);
      file.create({ overwrite: true });
      file.write(base64, { encoding: 'base64' });
      try {
        await file.preview({ title: att.originalName });
      } catch {
        Alert.alert('Preview unavailable', `Saved to ${file.uri}`);
      }
      void ext;
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionTitle>Attachments</SectionTitle>
      <NoticeBanner message={error} tone="warning" />
      {(list.data ?? []).length === 0 && !list.isLoading ? (
        <EmptyState text="No attachments yet. Max 10 MB — PDF, image or Word." />
      ) : (
        (list.data ?? []).map((a) => (
          <View key={a._id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                {a.originalName}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatDateTime(a.createdAt)} · {a.mimeType ?? ''}
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => open(a)}>
              Open
            </Text>
          </View>
        ))
      )}
      {canUpload ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 100 }}>
            <Button title="Photo" variant="secondary" onPress={pickCamera} loading={busy} />
          </View>
          <View style={{ flex: 1, minWidth: 100 }}>
            <Button title="Gallery" variant="secondary" onPress={pickImage} loading={busy} />
          </View>
          <View style={{ flex: 1, minWidth: 100 }}>
            <Button title="Document" variant="secondary" onPress={pickDocument} loading={busy} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
});

void Platform;
