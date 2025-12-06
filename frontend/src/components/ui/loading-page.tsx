import { LoadingSpinner } from './loading-spinner';

interface LoadingPageProps {
  message?: string;
}

/**
 * Full Page Loading Component
 */
export function LoadingPage({ message }: LoadingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 animate-in fade-in duration-500">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
