'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Upload, Bell, Search, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  color: string;
  shortcut?: string;
}

export const QuickActionsWidget: React.FC = () => {
  const params = useParams();
  const orgSlug = params.orgSlug as string | undefined;

  // Helper to create org-prefixed URLs
  const getHref = (path: string): string => {
    return orgSlug ? `/${orgSlug}${path}` : path;
  };

  const actions: QuickAction[] = [
    {
      icon: <UserPlus className="h-5 w-5" />,
      label: 'Add Contact',
      description: 'Create a new contact',
      href: getHref('/contacts/new'),
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900',
      shortcut: '⌘N',
    },
    {
      icon: <Upload className="h-5 w-5" />,
      label: 'Import Contacts',
      description: 'From Google or CSV',
      href: getHref('/settings/integrations'),
      color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900',
    },
    {
      icon: <Bell className="h-5 w-5" />,
      label: 'View Reminders',
      description: 'Check pending follow-ups',
      href: getHref('/reminders'),
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900',
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: 'Search',
      description: 'Find contacts quickly',
      onClick: () => {
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (searchInput) {
          searchInput.focus();
        }
      },
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900',
      shortcut: '⌘K',
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      label: 'Calendar View',
      description: 'See upcoming meetings',
      href: getHref('/calendar'),
      color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 hover:bg-teal-100 dark:hover:bg-teal-900',
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: 'Settings',
      description: 'Manage preferences',
      href: getHref('/settings'),
      color: 'text-muted-foreground bg-muted hover:bg-accent',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action, index) => {
            const content = (
              <div
                className={cn(
                  'group flex items-center gap-3 p-3 rounded-lg border border-border',
                  'transition-all duration-200 hover:shadow-md hover:border-primary/20',
                  'animate-in fade-in slide-in-from-bottom-2',
                  action.onClick && 'cursor-pointer'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                    action.color
                  )}
                >
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                {action.shortcut && (
                  <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.shortcut}
                  </kbd>
                )}
              </div>
            );

            if (action.href) {
              return (
                <Link key={index} href={action.href} className="block">
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                className="w-full text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
