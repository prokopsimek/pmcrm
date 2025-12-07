'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { IntegrationStatus, IntegrationType } from '@/types';
import { AlertTriangle, Check, Clock, Loader2, Unplug } from 'lucide-react';

interface IntegrationCardProps {
  type: IntegrationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  isConnected: boolean;
  isLoading?: boolean;
  comingSoon?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage?: () => void;
  className?: string;
  customActions?: React.ReactNode;
}

const statusConfig: Record<IntegrationStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: {
    label: 'Connected',
    icon: <Check className="h-3 w-3" />,
    variant: 'default'
  },
  DISCONNECTED: {
    label: 'Disconnected',
    icon: <Unplug className="h-3 w-3" />,
    variant: 'secondary'
  },
  ERROR: {
    label: 'Error',
    icon: <AlertTriangle className="h-3 w-3" />,
    variant: 'destructive'
  },
  PENDING: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    variant: 'outline'
  },
};

/**
 * Integration Card Component
 * Displays integration information with connect/disconnect actions
 */
export function IntegrationCard({
  name,
  description,
  icon,
  status,
  isConnected,
  isLoading = false,
  comingSoon = false,
  onConnect,
  onDisconnect,
  onManage,
  className,
  customActions,
}: IntegrationCardProps) {
  const statusInfo = statusConfig[status];

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md hover:border-primary/20',
        isConnected && 'ring-1 ring-primary/10',
        comingSoon && 'opacity-75',
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 w-14 h-14 bg-muted rounded-xl flex items-center justify-center transition-transform group-hover:scale-105',
            comingSoon && 'grayscale'
          )}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
              </div>
              {comingSoon ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 bg-muted text-muted-foreground"
                >
                  <Clock className="h-3 w-3" />
                  Coming Soon
                </Badge>
              ) : (
                <Badge
                  variant={statusInfo.variant}
                  className={cn(
                    'flex items-center gap-1',
                    status === 'ACTIVE' && 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
                    status === 'ERROR' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                    status === 'PENDING' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                  )}
                >
                  {statusInfo.icon}
                  {statusInfo.label}
                </Badge>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {comingSoon ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  >
                    Coming Soon
                  </Button>
                ) : isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    {isConnected ? (
                      <>
                        {onManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onManage}
                          >
                            Manage
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={onDisconnect}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={onConnect}
                      >
                        Connect
                      </Button>
                    )}
                  </>
                )}
              </div>
              {!comingSoon && customActions}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
