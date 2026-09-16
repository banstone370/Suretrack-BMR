import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { ROLE_LABELS } from '../../lib/utils';
import type { ApiResponse, Role } from '../../types';

interface UserRow {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  isActive: boolean;
}

const ROLES: Role[] = [
  'ADMIN',
  'PRODUCTION_CHEMIST',
  'QC_OFFICER',
  'PACKING_OPERATOR',
  'STERILIZATION_OPERATOR',
  'QA_APPROVER',
  'DISPATCH_USER',
];

const EMPTY = {
  employeeId: '',
  name: '',
  email: '',
  password: '',
  role: 'PRODUCTION_CHEMIST' as Role,
  department: '',
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<UserRow[]>>('/users');
      return data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/users', form);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm(EMPTY);
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Create failed',
      );
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.patch(`/users/${editId}`, {
        name: form.name,
        email: form.email,
        role: form.role,
        department: form.department,
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
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Update failed',
      );
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/users/${id}/deactivate`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) update.mutate();
    else create.mutate();
  }

  function startEdit(u: UserRow) {
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
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">Users</h1>
          <p className="mt-1 text-sm text-muted">Role-based system users</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setEditId(null);
            setForm(EMPTY);
            setError('');
          }}
          className="rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          {showForm ? 'Cancel' : 'Add user'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:grid-cols-2 sm:p-5"
        >
          {!editId && (
            <label className="text-sm font-medium">
              Employee ID
              <input
                required
                value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          )}
          <label className="text-sm font-medium">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            {editId ? 'New password (optional)' : 'Password'}
            <input
              required={!editId}
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Department
            <input
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-60"
            >
              {editId ? 'Update user' : 'Create user'}
            </button>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </form>
      )}

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Employee ID</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((user) => (
              <tr key={user._id} className="border-t border-line/70">
                <td className="px-5 py-3 font-medium">{user.employeeId}</td>
                <td className="px-5 py-3">{user.name}</td>
                <td className="px-5 py-3 text-muted">{user.email}</td>
                <td className="px-5 py-3">{ROLE_LABELS[user.role] ?? user.role}</td>
                <td className="px-5 py-3 text-muted">{user.department ?? '—'}</td>
                <td className="px-5 py-3">{user.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="text-xs text-brand-800 hover:underline"
                    >
                      Edit
                    </button>
                    {user.isActive && (
                      <button
                        type="button"
                        onClick={() => deactivate.mutate(user._id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
