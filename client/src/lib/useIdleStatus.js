'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from './stores/authStore';
import { getSocket } from './socket';

const IDLE_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

/**
 * Manages user presence status with idle detection and manual overrides.
 *
 * Manual modes:
 *   null      – auto mode: timer sets idle, activity restores online
 *   'online'  – user picked Online: same as auto
 *   'idle'    – user picked Away: timer/activity do NOT override
 *   'offline' – user picked Offline: timer/activity do NOT override
 *
 * Returns setManualStatus(status) to be called from UI.
 */
export function useIdleStatus() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // null = auto, otherwise the manually-chosen status
  const manualRef = useRef(null);
  const timerRef = useRef(null);

  const emitStatus = useCallback((status, statusMessage) => {
    const socket = getSocket();
    const msg = statusMessage !== undefined
      ? statusMessage
      : (useAuthStore.getState().user?.status_message ?? '');
    if (socket) socket.emit('status:set', { status, statusMessage: msg });
    const u = useAuthStore.getState().user;
    if (u) setUser({ ...u, status, status_message: msg });
  }, [setUser]);

  const startIdleTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const manual = manualRef.current;
      // Only auto-idle if in auto mode or manual=online
      if (manual === null || manual === 'online') {
        emitStatus('idle');
      }
    }, IDLE_MS);
  }, [emitStatus]);

  const onActivity = useCallback(() => {
    const manual = manualRef.current;
    if (manual === 'idle' || manual === 'offline') return;

    // If currently auto-idled, restore to online
    const currentStatus = useAuthStore.getState().user?.status;
    if (currentStatus === 'idle') {
      emitStatus('online');
    }
    startIdleTimer();
  }, [emitStatus, startIdleTimer]);

  useEffect(() => {
    if (!user) return;

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    startIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimeout(timerRef.current);
    };
  }, [!!user]); // only re-run when login state changes

  const setManualStatus = useCallback((status, statusMessage) => {
    manualRef.current = status === 'online' ? null : status;
    emitStatus(status, statusMessage);
    if (status === 'online' || status === null) {
      startIdleTimer();
    } else {
      clearTimeout(timerRef.current);
    }
  }, [emitStatus, startIdleTimer]);

  return { setManualStatus };
}
