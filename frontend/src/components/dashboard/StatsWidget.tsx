'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatsWidgetProps {
  title: string;
  value: number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  link?: string;
  colorClass?: string;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  link,
  colorClass = 'text-primary',
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
    if (trend === 'down') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
    return 'text-muted-foreground bg-muted';
  };

  const content = (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg bg-muted transition-colors',
              colorClass
            )}
          >
            {icon}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {value.toLocaleString()}
          </p>

          <div className="flex items-center justify-between">
            {change !== undefined && (
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                <span>{change > 0 ? '+' : ''}{change}%</span>
              </div>
            )}

            {link && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View all
                <ArrowUpRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (link) {
    return (
      <Link href={link} className="block">
        {content}
      </Link>
    );
  }

  return content;
};
