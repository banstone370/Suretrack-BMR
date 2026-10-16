import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../../src/state/AuthContext';
import { Button, Card, Screen, SectionTitle } from '../../../src/components/ui';
import { colors } from '../../../src/lib/theme';
import { roleLabel } from '../../../src/lib/format';

interface Item {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
  show: boolean;
}

export default function MorePage() {
  const { user, hasPermission, logout } = useAuth();
  const router = useRouter();

  const items = ([
    { icon: 'cube-outline', label: 'Products', href: '/(app)/products', show: true },
    { icon: 'flask-outline', label: 'ETO Cartridges', href: '/(app)/eto-cartridges', show: true },
    { icon: 'business-outline', label: 'Finished Goods Inventory', href: '/(app)/inventory', show: true },
    { icon: 'people-outline', label: 'Customers', href: '/(app)/customers', show: true },
    { icon: 'car-outline', label: 'Dispatches', href: '/(app)/dispatches', show: true },
    { icon: 'document-text-outline', label: 'SOPs', href: '/(app)/sops', show: true },
    { icon: 'bar-chart-outline', label: 'Reports', href: '/(app)/reports', show: true },
    { icon: 'people-circle-outline', label: 'Users', href: '/(app)/users', show: hasPermission('users:manage') },
    { icon: 'list-outline', label: 'Audit Trail', href: '/(app)/audit-logs', show: hasPermission('audit:view') },
    { icon: 'settings-outline', label: 'Settings', href: '/(app)/settings', show: hasPermission('system:configure') },
    { icon: 'compass-outline', label: 'Role Guide', href: '/(app)/role-guide', show: true },
  ] as Item[]).filter((i) => i.show);

  return (
    <Screen>
      <Card>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userMeta}>
          {roleLabel(user?.role)} · {user?.employeeId} · {user?.email}
        </Text>
      </Card>
      <Card>
        <SectionTitle>Workspace</SectionTitle>
        {items.map((i) => (
          <Pressable
            key={i.label}
            onPress={() => router.push(i.href as never)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={i.icon} size={20} color={colors.primary} />
            <Text style={styles.rowLabel}>{i.label}</Text>
            <Text style={{ color: colors.muted }}>›</Text>
          </Pressable>
        ))}
      </Card>
      <Button title="Sign out" variant="danger" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  userName: { fontSize: 17, fontWeight: '800', color: colors.text },
  userMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
});
