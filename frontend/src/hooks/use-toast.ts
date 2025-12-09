import { toast as sonnerToast } from 'sonner';

/**
 * Toast configuration types for consistent toast messaging
 */
interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Centralized toast hook for consistent notifications across the app
 * Wraps sonner toast with predefined styles and behaviors
 */
export function useAppToast() {
  const success = (message: string, options?: ToastOptions) => {
    sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  };

  const error = (message: string, options?: ToastOptions) => {
    sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration ?? 6000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  };

  const warning = (message: string, options?: ToastOptions) => {
    sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  };

  const info = (message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  };

  const loading = (message: string, options?: ToastOptions) => {
    return sonnerToast.loading(message, {
      description: options?.description,
    });
  };

  const dismiss = (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  };

  const promise = <T,>(
    promiseFn: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ) => {
    return sonnerToast.promise(promiseFn, messages);
  };

  return {
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    promise,
    // Also expose raw toast for advanced use cases
    toast: sonnerToast,
  };
}

/**
 * Common toast messages for reuse
 */
export const toastMessages = {
  // Generic
  genericError: {
    message: 'Something went wrong',
    description: 'Please try again later.',
  },
  networkError: {
    message: 'Network error',
    description: 'Please check your connection and try again.',
  },
  unauthorized: {
    message: 'Session expired',
    description: 'Please log in again.',
  },

  // Contacts
  contactCreated: (name: string) => ({
    message: 'Contact created',
    description: `${name} has been added to your contacts.`,
  }),
  contactUpdated: (name: string) => ({
    message: 'Contact updated',
    description: `${name}'s information has been updated.`,
  }),
  contactDeleted: (name: string) => ({
    message: 'Contact deleted',
    description: `${name} has been removed from your contacts.`,
  }),

  // Reminders
  reminderCreated: {
    message: 'Reminder created',
    description: 'Your reminder has been scheduled.',
  },
  reminderCompleted: {
    message: 'Reminder completed',
    description: 'The reminder has been marked as done.',
  },
  reminderSnoozed: {
    message: 'Reminder snoozed',
    description: 'The reminder has been snoozed.',
  },

  // Integrations
  integrationConnected: (name: string) => ({
    message: `${name} connected`,
    description: 'Your integration is now active.',
  }),
  integrationDisconnected: (name: string) => ({
    message: `${name} disconnected`,
    description: 'Your imported data will remain.',
  }),
  importComplete: (count: number) => ({
    message: 'Import complete',
    description: `${count} contacts have been imported.`,
  }),
};













