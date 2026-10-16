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
  SelectField,
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import { ALL_ROLES, roleLabel } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

interface UserRow {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
}

const EMPTY = {
  employeeId: '',
  name: '',
  email: '',
  password: '',
  role: 'PRODUCTION_CHEMIST',
  department: '',
};

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const canManage = hasPermission('users:manage');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => unwrap(await api.get<ApiResponse<UserRow[]>>('/users')),
  });

  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.post<ApiResponse<UserRow>>('/users', {
          employeeId: form.employeeId.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          department: form.department.trim() || undefined,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm(EMPTY);
      setShowForm(false);
      setEditId(null);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Create failed')),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.patch(`/users/${editId}`, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.department.trim(),
        ...(form.password ? { password: form.password } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditId(null);
      setForm(EMPTY);
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Update failed')),
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/users/${id}/deactivate`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Deactivate failed')),
  });

  const submit = () => {
    setError('');
    if (!editId && !form.employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!editId && form.password.length < 8) {
      setError('Password is required and must be at least 8 characters.');
      return;
    }
    if (editId && form.password && form.password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (editId) update.mutate();
    else create.mutate();
  };

  const startEdit = (u: UserRow) => {
    setEditId(u._id);
    setShowForm(true);
    setForm({
      employeeId: u.employeeId,
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      department: u.department ?? '',
    });
    setError('');
  };

  const busy = create.isPending || update.isPending;

  return (
    <Screen>
      <Card>
        <SectionTitle>Users</SectionTitle>
        <Text style={styles.sub}>Role-based system users</Text>
        {canManage ? (
          <Button
            title={showForm ? 'Cancel' : 'Add user'}
            variant={showForm ? 'ghost' : 'primary'}
            onPress={() => {
              setShowForm((v) => !v);
              setEditId(null);
              setForm(EMPTY);
              setError('');
            }}
          />
        ) : null}
      </Card>

      {canManage && showForm ? (
        <Card>
          <SectionTitle>{editId ? 'Edit user' : 'New user'}</SectionTitle>
          {!editId ? (
            <Field
              label="Employee ID"
              value={form.employeeId}
              onChangeText={(v) => setForm((f) => ({ ...f, employeeId: v }))}
            />
          ) : (
            <Field label="Employee ID" value={form.employeeId} editable={false} />
          )}
          <Field label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
          <Field
            label="Email"
            value={form.email}
            onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            keyboardType="email-address"
          />
          <Field
            label={editId ? 'New password (optional)' : 'Password'}
            value={form.password}
            onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
            secureTextEntry
            placeholder="Minimum 8 characters"
          />
          <SelectField
            label="Role"
            value={form.role}
            options={ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
          />
          <Field
            label="Department (optional)"
            value={form.department}
            onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
            autoCapitalize="words"
          />
          <ErrorBanner message={error} />
          <Button
            title={busy ? 'Saving…' : editId ? 'Update user' : 'Create user'}
            variant="success"
            onPress={submit}
            loading={busy}
          />
        </Card>
      ) : null}

      {users.isLoading ? <Loading label="Loading users…" /> : null}
      {users.error ? <ErrorBanner message={apiErrorMessage(users.error)} /> : null}
      {users.isSuccess && (users.data?.length ?? 0) === 0 ? (
        <EmptyState text="No users found." />
      ) : null}

      {(users.data ?? []).map((u) => (
        <Card key={u._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{u.name}</Text>
            <Badge text={u.isActive ? 'Active' : 'Inactive'} tone={u.isActive ? 'success' : 'grey'} />
          </View>
          <Text style={styles.sub}>{u.employeeId} · {roleLabel(u.role)}</Text>
          <Text style={styles.sub}>{u.email}</Text>
          {u.department ? <Text style={styles.sub}>Department: {u.department}</Text> : null}
          {canManage && u.isActive ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="Edit" variant="secondary" onPress={() => startEdit(u)} />
              <Button
                title="Deactivate"
                variant="danger"
                onPress={() => deactivate.mutate(u._id)}
                loading={deactivate.isPending && deactivate.variables === u._id}
              />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
