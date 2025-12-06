'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/organization';
import { useAuth } from '@/hooks';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  orgScoped?: boolean; // Whether this route should include org slug
}

// Navigation items that are scoped to organization
const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    orgScoped: true,
  },
  {
    title: 'Contacts',
    href: '/contacts',
    icon: Users,
    orgScoped: true,
  },
  {
    title: 'Calendar',
    href: '/calendar',
    icon: Calendar,
    orgScoped: true,
  },
  {
    title: 'Reminders',
    href: '/reminders',
    icon: Bell,
    orgScoped: true,
  },
  {
    title: 'Recommendations',
    href: '/recommendations',
    icon: Sparkles,
    orgScoped: true,
  },
];

const bottomNavItems: NavItem[] = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    orgScoped: true,
  },
];

// Admin nav items - only shown to ADMIN users (global, not org-scoped)
const adminNavItems: NavItem[] = [
  {
    title: 'Admin',
    href: '/admin/users',
    icon: Shield,
    orgScoped: false,
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Get org slug from URL params
  const orgSlug = params.orgSlug as string | undefined;

  // Helper to create org-prefixed URLs
  const getHref = (item: NavItem): string => {
    if (item.orgScoped && orgSlug) {
      return `/${orgSlug}${item.href}`;
    }
    return item.href;
  };

  const isActive = (item: NavItem) => {
    const href = getHref(item);
    if (item.href === '/dashboard') {
      return pathname === href || pathname === `/${orgSlug}`;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-border bg-card transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-border px-4',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!collapsed && (
            <Link href={orgSlug ? `/${orgSlug}/dashboard` : '/organizations'} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="h-4 w-4" />
              </div>
              <span className="font-semibold text-foreground">Network CRM</span>
            </Link>
          )}
          {collapsed && (
            <Link href={orgSlug ? `/${orgSlug}/dashboard` : '/organizations'}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="h-4 w-4" />
              </div>
            </Link>
          )}
        </div>

        {/* Organization Switcher */}
        {!collapsed && (
          <div className="border-b border-border p-2">
            <OrganizationSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const href = getHref(item);

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-border p-2">
          {/* Admin link - only for ADMIN users */}
          {isAdmin && adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const href = getHref(item);

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}

          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const href = getHref(item);

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}

          {/* Collapse Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'mt-2 w-full',
              collapsed ? 'justify-center px-2' : 'justify-start'
            )}
            onClick={() => onCollapsedChange?.(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}


