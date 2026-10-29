import api from './api';
import { User } from '../types';

export const authService = {
  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const res = await api.post('/auth/login', { username, password });
    const token = res.data.access_token || res.data.token;
    const rawUser = res.data.user || res.data;
    const user: User = {
      id: String(rawUser.user_id || rawUser.id || rawUser._id || 1),
      _id: String(rawUser.user_id || rawUser.id || rawUser._id || 1),
      name: rawUser.full_name || rawUser.name || rawUser.username,
      username: rawUser.username,
      role: rawUser.role || 'admin',
      permissions: ['*'],
      isActive: rawUser.is_active ?? rawUser.isActive ?? true,
    };
    if (token) {
      localStorage.setItem('khata_token', token);
      localStorage.setItem('khata_user', JSON.stringify(user));
    }
    return { user, token };
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout').catch(() => {});
    } finally {
      localStorage.removeItem('khata_token');
      localStorage.removeItem('khata_user');
    }
  },

  async getMe(): Promise<User> {
    const res = await api.get('/auth/me');
    const u = res.data.user || res.data;
    return {
      id: String(u.id || u._id),
      _id: String(u.id || u._id),
      name: u.full_name || u.name,
      username: u.username,
      role: u.role,
      permissions: ['*'],
      isActive: u.is_active ?? u.isActive ?? true,
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};
