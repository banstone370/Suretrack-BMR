import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../src/lib/api';
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
import { formatDateTime } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

interface AuditRow {
  _id: string;
  actorName?: string;
  actorEmployeeId?: string;
  action: string;
  entityType: string;
  batchId?: string;
  reason?: string;
  createdAt: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [applied, setApplied] = useState({ action: '', actor: '' });
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '100' };
    if (applied.action) p.action = applied.action;
    if (applied.actor) p.actor = applied.actor;
    return p;
  }, [applied]);

  const logs = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => unwrap(await api.get<ApiResponse<AuditRow[]>>('/audit-logs', { params })),
  });

  return (
    <Screen>
      <Card>
        <SectionTitle>Audit Trail</SectionTitle>
        <Text style={styles.sub}>System-wide activity log (append-only)</Text>
        <Field label="Filter action" value={action} onChangeText={setAction} placeholder="e.g. BATCH_RELEASED" />
        <Field label="Filter user / employee ID" value={actor} onChangeText={setActor} />
        <Button
          title="Search"
          variant="secondary"
          onPress={() => setApplied({ action: action.trim(), actor: actor.trim() })}
        />
      </Card>

      {logs.isLoading ? <Loading label="Loading audit trail…" /> : null}
      {logs.error ? <ErrorBanner message={apiErrorMessage(logs.error)} /> : null}
      {logs.isSuccess && (logs.data?.length ?? 0) === 0 ? (
        <EmptyState text="No audit entries." />
      ) : null}

      {(logs.data ?? []).map((row) => {
        const open = expanded === row._id;
        return (
          <Card key={row._id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={styles.action}>{row.action}</Text>
              <Text style={styles.sub}>{row.entityType}</Text>
            </View>
            <Text style={styles.sub}>
              {row.actorName ?? '—'}
              {row.actorEmployeeId ? ` (${row.actorEmployeeId})` : ''}
            </Text>
            <Text style={styles.sub}>{formatDateTime(row.createdAt)}</Text>
            {row.reason ? <Text style={styles.reason}>Reason: {row.reason}</Text> : null}
            <Pressable
              onPress={() => setExpanded(open ? null : row._id)}
              style={({ pressed }) => [styles.detailToggle, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {open ? 'Hide details' : 'Details'}
              </Text>
            </Pressable>
            {open ? (
              <View style={styles.detailBox}>
                <Text style={styles.detailText}>
                  {JSON.stringify({ oldValue: row.oldValue, newValue: row.newValue }, null, 2)}
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
  sub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  action: { fontWeight: '800', fontSize: 14, color: colors.text, flexShrink: 1 },
  reason: { color: colors.warning, fontSize: 13, marginTop: 3 },
  detailToggle: { marginTop: 8 },
  detailBox: {
    marginTop: 8,
    backgroundColor: colors.greyLight,
    borderRadius: 8,
    padding: 10,
  },
  detailText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
