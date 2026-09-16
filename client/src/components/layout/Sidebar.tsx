import {
  Bell,
  Boxes,
  ClipboardCheck,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Shield,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { openRoleGuide } from '../../features/tour/RoleGuideModal';
import { api } from '../../lib/api';
import { cn, ROLE_LABELS } from '../../lib/utils';
import type { ApiResponse } from '../../types';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inbox', label: 'Inbox', icon: Bell },
  { to: '/batches', label: 'Batches', icon: Boxes },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/eto-cartridges', label: 'ETO Cartridges', icon: FlaskConical },
  { to: '/inventory', label: 'Finished Goods', icon: ClipboardCheck },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/dispatches', label: 'Dispatch', icon: Truck },
  { to: '/sops', label: 'SOPs', icon: FileText },
  { to: '/users', label: 'Users', icon: Users, permission: 'users:manage' },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/audit-logs', label: 'Audit Trail', icon: Shield, permission: 'audit:view' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'system:configure' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function tourIdForPath(to: string) {
  return `nav-${to.replace(/^\//, '').replace(/\//g, '-')}`;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();

  const pending = useQuery({
    queryKey: ['notifications-pending'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ unreadCount: number }>>(
        '/notifications/pending',
      );
      return data.data;
    },
    refetchInterval: 30000,
  });

  const unread = pending.data?.unreadCount ?? 0;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-line/80 bg-brand-950 text-brand-50 transition-transform duration-200 ease-out md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-white">
            SureTech Medical
          </p>
          <p className="mt-0.5 text-xs text-brand-100/70">eBMR System</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-brand-100/80 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.filter((item) => !item.permission || hasPermission(item.permission)).map(
          (item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour={tourIdForPath(item.to)}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition md:py-2',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-brand-100/80 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon size={16} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.to === '/inbox' && unread > 0 && (
                <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          ),
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-xs text-brand-100/60">
            {user ? ROLE_LABELS[user.role] : ''} · {user?.employeeId}
          </p>
        </div>
        <button
          type="button"
          data-tour="nav-role-guide"
          onClick={() => {
            onClose();
            openRoleGuide();
          }}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2.5 text-sm text-brand-100 hover:bg-white/5"
        >
          <GraduationCap size={14} />
          Role guide & tour
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            logout();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2.5 text-sm text-brand-100 hover:bg-white/5"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
