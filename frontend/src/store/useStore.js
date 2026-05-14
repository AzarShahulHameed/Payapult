// frontend/src/store/useStore.js
import { create } from 'zustand';
import { authAPI } from '../api/client';

const load = () => {
  try {
    return {
      user: JSON.parse(localStorage.getItem('pp_user') || 'null'),
      token: localStorage.getItem('pp_token') || null,
      isAuthenticated: !!localStorage.getItem('pp_token'),
    };
  } catch { return { user: null, token: null, isAuthenticated: false }; }
};

const useStore = create((set) => ({
  ...load(),

  login: async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token, refreshToken, user } = res.data;
    localStorage.setItem('pp_token', token);
    localStorage.setItem('pp_refresh', refreshToken);
    localStorage.setItem('pp_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    try { await authAPI.logout(); } catch (_) {}
    ['pp_token','pp_refresh','pp_user'].forEach(k => localStorage.removeItem(k));
    set({ user: null, token: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    try {
      const res = await authAPI.me();
      const user = res.data.user;
      localStorage.setItem('pp_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (_) { set({ user: null, isAuthenticated: false }); }
  },

  setUser: (user) => {
    localStorage.setItem('pp_user', JSON.stringify(user));
    set({ user });
  },
}));

export default useStore;
