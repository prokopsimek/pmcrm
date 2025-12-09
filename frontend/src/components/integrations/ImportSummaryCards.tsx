'use client';

import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, HelpCircle, Users } from 'lucide-react';

interface ImportSummaryCardsProps {
  total: number;
  readyToImport: number;
  exactDuplicates: number;
  potentialDuplicates: number;
  className?: string;
}

/**
 * Import Summary Cards - Shows statistics about contacts to import
 */
export function ImportSummaryCards({
  total,
  readyToImport,
  exactDuplicates,
  potentialDuplicates,
  className,
}: ImportSummaryCardsProps) {
  const stats = [
    {
      label: 'Ready to Import',
      value: readyToImport,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      iconBg: 'bg-green-100 dark:bg-green-900/50',
    },
    {
      label: 'Exact Duplicates',
      value: exactDuplicates,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      description: 'Will be skipped',
    },
    {
      label: 'Potential Matches',
      value: potentialDuplicates,
      icon: HelpCircle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      description: 'Review recommended',
    },
    {
      label: 'Total Contacts',
      value: total,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              'relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:shadow-md',
              stat.bgColor,
              stat.borderColor,
              'animate-in fade-in slide-in-from-bottom-2'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className={cn('text-3xl font-bold mt-1', stat.color)}>
                  {stat.value.toLocaleString()}
                </p>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                )}
              </div>
              <div className={cn('rounded-lg p-2', stat.iconBg)}>
                <Icon className={cn('h-5 w-5', stat.color)} />
              </div>
            </div>

            {/* Decorative gradient */}
            <div
              className={cn(
                'absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl',
                stat.color.replace('text-', 'bg-')
              )}
            />
          </div>
        );
      })}
    </div>
  );
}










