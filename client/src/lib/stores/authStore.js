import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectSocket, disconnectSocket } from '../socket';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      login: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        connectSocket(accessToken);
      },

      logout: () => {
        disconnectSocket();
        set({ user: null, accessToken: null, refreshToken: null });
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
