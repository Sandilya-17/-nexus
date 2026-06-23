import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Username-only login
      login: async (username) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { username });
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isAuthenticated: true, isLoading: false });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, message: err.response?.data?.message || 'Login failed' };
        }
      },

      // Username + name registration
      register: async (name, username) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', { name, username });
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isAuthenticated: true, isLoading: false });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, message: err.response?.data?.message || 'Registration failed' };
        }
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch (e) {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      setToken: (token) => {
        set({ token });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      refreshSession: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const { data } = await api.post('/auth/refresh-token', { refreshToken });
          set({ token: data.token, refreshToken: data.refreshToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          return true;
        } catch {
          get().logout();
          return false;
        }
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
      },
    }
  )
);

export default useAuthStore;
