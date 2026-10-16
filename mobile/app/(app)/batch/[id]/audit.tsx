import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../../../src/lib/api';
import { Card, ErrorBanner, Loading, Screen, SectionTitle } from '../../../../src/components/ui';
import { colors } from '../../../../src/lib/theme';
import { formatDateTime } from '../../../../src/lib/format';
import type { ApiResponse } from '../../../../src/types';

interface AuditEntry {
  _id: string;
  createdAt: string;
  actorName?: string;
  actorEmployeeId?: string;
  action: string;
  entityType?: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export default function BatchAuditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expanded, setExpanded] = useState<string | null>(null);

  const audit = useQuery({
    queryKey: ['batch-audit', id],
    queryFn: async () =>
      unwrap(await api.get<ApiResponse<AuditEntry[]>>(`/batches/${id}/audit`)),
  });

  if (audit.isLoading) return <Loading />;
  if (audit.error)
    return (
      <Screen>
        <ErrorBanner message={apiErrorMessage(audit.error)} />
      </Screen>
    );

  return (
    <Screen>
      {(audit.data ?? []).map((a) => (
        <Card key={a._id}>
          <Pressable onPress={() => setExpanded(expanded === a._id ? null : a._id)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.action}>{a.action}</Text>
              <Text style={styles.time}>{formatDateTime(a.createdAt)}</Text>
            </View>
            <Text style={styles.meta}>
              {a.actorName ?? 'System'}
              {a.actorEmployeeId ? ` (${a.actorEmployeeId})` : ''} · {a.entityType ?? ''}
            </Text>
            {a.reason ? <Text style={styles.reason}>{a.reason}</Text> : null}
            {expanded === a._id ? (
              <Text style={styles.json}>
                {JSON.stringify({ oldValue: a.oldValue, newValue: a.newValue }, null, 2)}
              </Text>
            ) : (
              <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>Tap to expand details</Text>
            )}
          </Pressable>
        </Card>
      ))}
      {(audit.data ?? []).length === 0 ? <SectionTitle>No audit entries for this batch.</SectionTitle> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { fontWeight: '800', color: colors.primary, flex: 1 },
  time: { color: colors.muted, fontSize: 11 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  reason: { color: colors.danger, fontSize: 12, marginTop: 4 },
  json: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.greyLight,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
});
