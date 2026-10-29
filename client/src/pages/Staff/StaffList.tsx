import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, UserCheck, Edit2, Lock } from 'lucide-react';
import { userService } from '../../services/userService';
import { User } from '../../types';
import { StaffFormModal } from './StaffFormModal';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDateTime } from '../../utils/formatters';

export const StaffList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<User | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    setToggleLoading(true);
    try {
      await userService.toggleUserStatus(confirmToggle.id || (confirmToggle as any)._id);
      setConfirmToggle(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Staff Accounts & Security</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage multiple counter staff, access credentials, and administrative permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setUserToEdit(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u: any) => (
                <tr key={u._id || u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{u.username}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {u.phone && <div className="font-mono text-[11px] font-medium text-slate-800">{u.phone}</div>}
                    {u.email && <div className="text-[11px] text-slate-400">{u.email}</div>}
                    {!u.phone && !u.email && <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={u.role === 'admin' ? 'indigo' : 'slate'}>
                      {u.role === 'admin' ? 'Administrator' : 'Counter Staff'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{formatDateTime(u.lastLoginAt) || 'Never'}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={u.isActive ? 'emerald' : 'rose'}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUserToEdit(u);
                        setModalOpen(true);
                      }}
                      className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs font-medium"
                    >
                      <Edit2 className="w-3 h-3 text-slate-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmToggle(u)}
                      className={`text-xs font-medium ${
                        u.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <StaffFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchUsers}
        userToEdit={userToEdit}
      />

      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleStatus}
        title={confirmToggle?.isActive ? 'Deactivate Staff Member?' : 'Activate Staff Member?'}
        message={`Are you sure you want to ${
          confirmToggle?.isActive ? 'deactivate' : 'activate'
        } ${confirmToggle?.name}? Deactivated staff will be blocked from logging in immediately.`}
        confirmLabel={confirmToggle?.isActive ? 'Deactivate' : 'Activate'}
        isDestructive={confirmToggle?.isActive}
        loading={toggleLoading}
      />
    </div>
  );
};
