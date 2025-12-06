import { useEffect, useCallback } from 'react';

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  callback: () => void,
  options?: {
    enabled?: boolean;
    preventDefault?: boolean;
  }
) {
  const { enabled = true, preventDefault = true } = options || {};

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const {
        key,
        ctrl = false,
        meta = false,
        shift = false,
        alt = false,
      } = shortcut;

      const matches =
        event.key.toLowerCase() === key.toLowerCase() &&
        event.ctrlKey === ctrl &&
        event.metaKey === meta &&
        event.shiftKey === shift &&
        event.altKey === alt;

      if (matches && enabled) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback();
      }
    },
    [shortcut, callback, enabled, preventDefault]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Hook for Cmd+K / Ctrl+K shortcut (cross-platform)
 */
export function useCmdK(callback: () => void, enabled: boolean = true) {
  const isMac = typeof window !== 'undefined' && /Mac/.test(navigator.platform);

  useKeyboardShortcut(
    {
      key: 'k',
      meta: isMac,
      ctrl: !isMac,
    },
    callback,
    { enabled }
  );
}

/**
 * Hook for Escape key
 */
export function useEscape(callback: () => void, enabled: boolean = true) {
  useKeyboardShortcut({ key: 'Escape' }, callback, { enabled });
}

/**
 * Hook for arrow key navigation
 */
export function useArrowNavigation(
  callbacks: {
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onArrowLeft?: () => void;
    onArrowRight?: () => void;
    onEnter?: () => void;
  },
  enabled: boolean = true
) {
  const { onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter } = callbacks;

  useKeyboardShortcut(
    { key: 'ArrowUp' },
    () => onArrowUp?.(),
    { enabled: enabled && !!onArrowUp }
  );

  useKeyboardShortcut(
    { key: 'ArrowDown' },
    () => onArrowDown?.(),
    { enabled: enabled && !!onArrowDown }
  );

  useKeyboardShortcut(
    { key: 'ArrowLeft' },
    () => onArrowLeft?.(),
    { enabled: enabled && !!onArrowLeft }
  );

  useKeyboardShortcut(
    { key: 'ArrowRight' },
    () => onArrowRight?.(),
    { enabled: enabled && !!onArrowRight }
  );

  useKeyboardShortcut(
    { key: 'Enter' },
    () => onEnter?.(),
    { enabled: enabled && !!onEnter }
  );
}
