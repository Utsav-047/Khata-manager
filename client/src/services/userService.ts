import api from './api';
import { User } from '../types';

function mapUser(u: any): User {
  return {
    id: String(u.id ?? u._id),
    _id: String(u.id ?? u._id),
    name: u.full_name || u.name || u.username,
    username: u.username,
    email: u.email ?? '',
    phone: u.phone ?? '',
    role: u.role || 'staff',
    permissions: ['*'],
    isActive: u.is_active ?? u.isActive ?? true,
    lastLoginAt: u.updated_at,
  };
}

export const userService = {
  async getUsers(): Promise<User[]> {
    const res = await api.get('/users');
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    return list.map(mapUser);
  },

  async createUser(data: { name: string; username: string; password: string; role: string; email?: string; phone?: string; permissions?: string[] }): Promise<User> {
    const body = {
      username: data.username,
      full_name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      password: data.password,
      role: data.role.toLowerCase(),
    };
    const res = await api.post('/users', body);
    const raw = res.data?.data || res.data;
    return mapUser(raw);
  },

  async updateUser(id: string, data: Partial<User> & { password?: string }): Promise<User> {
    const body: any = {};
    if (data.name !== undefined) body.full_name = data.name;
    if (data.email !== undefined) body.email = data.email || null;
    if (data.phone !== undefined) body.phone = data.phone || null;
    if (data.role !== undefined) body.role = data.role.toLowerCase();
    if (data.password) body.password = data.password;
    if (data.isActive !== undefined) body.is_active = data.isActive;

    const res = await api.patch(`/users/${id}`, body);
    const raw = res.data?.data || res.data;
    return mapUser(raw);
  },

  async toggleUserStatus(id: string): Promise<User> {
    const curr = await api.get(`/users/${id}`);
    const u = curr.data?.data || curr.data;
    const res = await api.patch(`/users/${id}`, { is_active: !u.is_active });
    const raw = res.data?.data || res.data;
    return mapUser(raw);
  },
};
