import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { Badge } from '../../components/Badge';
import { formatDateTime } from '../../utils/formatters';

export const AuditLogsList: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', {
        params: {
          action: actionFilter || undefined,
          limit: 100,
        },
      });
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('REVERSE') || action.includes('FAILED') || action.includes('DEACTIVATE')) return 'rose';
    if (action.includes('CREATE') || action.includes('SUCCESS')) return 'emerald';
    if (action.includes('UPDATE') || action.includes('ALLOCATE')) return 'amber';
    return 'slate';
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Audit Trail</h2>
        <p className="text-xs text-slate-500 mt-1">
          Immutable forensic log of all financial sales, payment collections, reversals, and user logins.
        </p>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="">All Audit Events</option>
            <option value="CREATE_INVOICE">CREATE_INVOICE</option>
            <option value="REVERSE_INVOICE">REVERSE_INVOICE</option>
            <option value="CREATE_PAYMENT">CREATE_PAYMENT</option>
            <option value="REVERSE_PAYMENT">REVERSE_PAYMENT</option>
            <option value="ALLOCATE_PAYMENT">ALLOCATE_PAYMENT</option>
            <option value="CREATE_CUSTOMER">CREATE_CUSTOMER</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          </select>
        </div>
        <span className="text-slate-400">{logs.length} Logged Events</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Details / Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{log.usernameSnapshot || 'SYSTEM'}</td>
                  <td className="py-3 px-4">
                    <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-600">{log.entityType}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{log.entityId}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
