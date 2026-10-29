import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  BookOpen,
  Edit2,
  Download,
  Filter,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Customer } from '../../types';
import { CustomerFormModal } from './CustomerFormModal';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatINR } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';
import { useLanguage } from '../../context/LanguageContext';

export const CustomersList: React.FC = () => {
  const { t, isGujarati } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Customer | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerService.getCustomers({
        search: search.trim() || undefined,
        status: statusFilter,
        limit: 100,
      });
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleExportCSV = () => {
    const headers = isGujarati
      ? ['ગ્રાહક કોડ', 'નામ', 'મોબાઈલ', 'સરનામું', 'શરૂઆતની બાકી (₹)', 'બાકી રકમ (₹)', 'સ્થિતિ']
      : ['Customer Code', 'Name', 'Mobile', 'Address', 'Opening Balance (₹)', 'Outstanding Balance (₹)', 'Status'];

    const rows = customers.map(c => [
      c.customerCode,
      c.name,
      c.mobile || '',
      c.address || '',
      c.openingBalanceRupees || 0,
      c.outstandingBalanceRupees || 0,
      c.isActive ? (isGujarati ? 'સક્રિય' : 'Active') : (isGujarati ? 'નિષ્ક્રિય' : 'Inactive'),
    ]);
    exportToCSV(`customers_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    setToggleLoading(true);
    try {
      await customerService.toggleCustomerStatus(confirmToggle._id);
      setConfirmToggle(null);
      fetchCustomers();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('customers', 'Customer Accounts')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('customersSubtitle', 'Manage customer credit ledgers, view outstanding balance, and record sales.')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t('exportCSV', 'Export CSV')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomerToEdit(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addNewCustomer', 'Add Customer')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder', 'Search by customer name, mobile number, or code...')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-700"
          >
            <option value="active">{isGujarati ? 'માત્ર સક્રિય ખાતાઓ' : 'Active Accounts Only'}</option>
            <option value="all">{isGujarati ? 'બધા ખાતાઓ' : 'All Accounts'}</option>
            <option value="inactive">{isGujarati ? 'નિષ્ક્રિય ખાતાઓ' : 'Inactive / Deactivated'}</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          title={isGujarati ? 'કોઈ ગ્રાહક મળ્યા નથી' : 'No customers found'}
          description={isGujarati ? 'ખાતાવહી અને વેચાણ શરૂ કરવા નવો ગ્રાહક ઉમેરો.' : 'Start by adding your first customer to maintain their credit ledger and sales.'}
          actionLabel={t('addNewCustomer', 'Add Customer Now')}
          onAction={() => {
            setCustomerToEdit(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Mobile Cards View (< 768px) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {customers.map((c) => {
              const bal = c.outstandingBalanceRupees || 0;
              const hasDue = bal > 0;
              const isAdvance = bal < 0;

              return (
                <div key={c._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {c.customerCode}
                        </span>
                      </div>
                      {c.mobile && (
                        <div className="text-xs text-slate-600 font-mono">
                          📱 {c.mobile}
                        </div>
                      )}
                      {c.address && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                          {c.address}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-bold text-base block ${
                          hasDue ? 'text-rose-600' : isAdvance ? 'text-blue-600' : 'text-emerald-600'
                        }`}
                      >
                        {formatINR(Math.abs(bal))}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {hasDue
                          ? t('balanceDue', 'Balance Due')
                          : isAdvance
                          ? t('advanceCredit', 'Advance Credit')
                          : t('fullySettled', 'Fully Settled')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 text-xs">
                    <Badge variant={c.isActive ? 'emerald' : 'slate'}>
                      {c.isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/customers/${c._id}/ledger`)}
                        className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{t('viewLedger', 'Ledger')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerToEdit(c);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('customerCode', 'Code')}</th>
                  <th className="py-3 px-4">{t('customerFullName', 'Customer Name')}</th>
                  <th className="py-3 px-4">{t('customerMobile', 'Mobile')}</th>
                  <th className="py-3 px-4 text-right">{t('openingBalance', 'Opening Balance')}</th>
                  <th className="py-3 px-4 text-right">{t('debit', 'Total Debit')}</th>
                  <th className="py-3 px-4 text-right">{t('totalCredits', 'Total Paid')}</th>
                  <th className="py-3 px-4 text-right">{t('balanceDue', 'Outstanding Balance')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                  <th className="py-3 px-4 text-right">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => {
                  const bal = c.outstandingBalanceRupees || 0;
                  const hasDue = bal > 0;
                  const isAdvance = bal < 0;

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{c.customerCode}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{c.name}</span>
                        {c.address && <span className="text-[11px] text-slate-400 block truncate max-w-xs">{c.address}</span>}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        <div>{c.mobile || '-'}</div>
                        {c.email && <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{c.email}</div>}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatINR(c.openingBalanceRupees || 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatINR(c.totalDebitsRupees || 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                        {formatINR(c.totalPaymentsRupees || 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-bold text-sm ${
                            hasDue ? 'text-rose-600' : isAdvance ? 'text-blue-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatINR(Math.abs(bal))}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {hasDue
                            ? t('balanceDue', 'Balance Due')
                            : isAdvance
                            ? t('advanceCredit', 'Advance Credit')
                            : t('fullySettled', 'Fully Settled')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={c.isActive ? 'emerald' : 'slate'}>
                          {c.isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/customers/${c._id}/ledger`)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{t('viewLedger', 'Ledger')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerToEdit(c);
                            setModalOpen(true);
                          }}
                          title={t('editCustomer', 'Edit Customer')}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <CustomerFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchCustomers}
        customerToEdit={customerToEdit}
      />

      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleStatus}
        title={confirmToggle?.isActive ? 'Deactivate Customer?' : 'Activate Customer?'}
        message={`Are you sure you want to ${confirmToggle?.isActive ? 'deactivate' : 'activate'} account for ${confirmToggle?.name}? All historical financial records will remain completely intact.`}
        confirmLabel={confirmToggle?.isActive ? 'Deactivate' : 'Activate'}
        isDestructive={confirmToggle?.isActive}
        loading={toggleLoading}
      />
    </div>
  );
};
