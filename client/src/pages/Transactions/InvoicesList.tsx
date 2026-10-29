import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Eye,
  RotateCcw,
  Download,
  Filter,
  FileText,
} from 'lucide-react';
import { transactionService } from '../../services/transactionService';
import { TransactionInvoice } from '../../types';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { InvoicePrintModal } from '../../components/InvoicePrintModal';
import { Modal } from '../../components/Modal';
import { formatINR, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const InvoicesList: React.FC = () => {
  const [invoices, setInvoices] = useState<TransactionInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<TransactionInvoice | null>(null);

  // Reversal dialog
  const [reversalInvoice, setReversalInvoice] = useState<TransactionInvoice | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState('');

  const { isAdmin } = useAuth();
  const { t, isGujarati } = useLanguage();
  const navigate = useNavigate();

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await transactionService.getTransactions({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      });
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleExportCSV = () => {
    const headers = isGujarati
      ? ['બિલ નં.', 'તારીખ', 'ગ્રાહક', 'કોડ', 'કુલ બિલ રકમ (₹)', 'ચુકવેલ રકમ (₹)', 'બાકી રકમ (₹)', 'સ્થિતિ']
      : ['Invoice No', 'Date', 'Customer', 'Customer Code', 'Total (₹)', 'Paid (₹)', 'Remaining (₹)', 'Status'];

    const rows = invoices.map((inv) => {
      const customerName = typeof inv.customerId === 'object' ? inv.customerId?.name : 'Customer';
      const customerCode = typeof inv.customerId === 'object' ? inv.customerId?.customerCode : '';
      return [
        inv.invoiceNumber,
        formatDate(inv.transactionDate),
        customerName,
        customerCode,
        inv.totalAmountRupees,
        inv.allocatedAmountRupees || 0,
        inv.remainingBalanceRupees || 0,
        inv.status,
      ];
    });
    exportToCSV(`invoices_report_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleViewInvoice = async (inv: TransactionInvoice) => {
    try {
      const full = await transactionService.getTransactionById(inv._id);
      setSelectedInvoice(full);
    } catch (err) {
      setSelectedInvoice(inv);
    }
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalInvoice || !reversalReason.trim()) return;

    setReversalLoading(true);
    setReversalError('');
    try {
      await transactionService.reverseTransaction(reversalInvoice._id, reversalReason.trim());
      setReversalInvoice(null);
      setReversalReason('');
      fetchInvoices();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || (isGujarati ? 'બિલ રદ કરવામાં ભૂલ આવી' : 'Failed to reverse invoice');
      setReversalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setReversalLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('creditInvoices', 'Credit Invoices')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {isGujarati
              ? 'ગ્રાહકોના ઉધાર બિલ, લાઇન આઇટમ, ચુકવણી સ્થિતિ અને રદ કરવાની વ્યવસ્થા.'
              : 'Complete billing records, line items, payment status, and authorized reversals.'}
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
            onClick={() => navigate('/invoices/new')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('quickSale', 'New Credit Invoice')}</span>
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
            placeholder={isGujarati ? 'બિલ નંબર અથવા ગ્રાહકના નામથી શોધો...' : 'Search by invoice number (e.g. INV-0001) or customer name...'}
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
            <option value="all">{isGujarati ? 'બધી સ્થિતિ (All)' : 'All Statuses'}</option>
            <option value="POSTED">{isGujarati ? 'સક્રિય બિલ (Active)' : 'Active Invoices'}</option>
            <option value="unpaid">{isGujarati ? 'બાકી રકમ વાળા બિલ (Unpaid Due)' : 'Unpaid Due Invoices'}</option>
            <option value="paid">{isGujarati ? 'ચુકતે થયેલ બિલ (Fully Paid)' : 'Fully Paid Invoices'}</option>
            <option value="REVERSED">{isGujarati ? 'રદ કરેલ બિલ (Voided)' : 'Reversed / Voided'}</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isGujarati ? 'કોઈ બિલ મળ્યા નથી' : 'No invoices found'}
          description={isGujarati ? 'ગ્રાહક માટે નવું ઉધાર બિલ બનાવો.' : 'Generate your first multi-product credit invoice for a customer.'}
          actionLabel={t('quickSale', 'Create Invoice Now')}
          onAction={() => navigate('/invoices/new')}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('invoiceNo', 'Invoice No')}</th>
                  <th className="py-3 px-4">{t('date', 'Date')}</th>
                  <th className="py-3 px-4">{t('customerFullName', 'Customer')}</th>
                  <th className="py-3 px-4 text-right">{t('invoiceTotal', 'Invoice Total')}</th>
                  <th className="py-3 px-4 text-right">{t('paidAmount', 'Allocated Paid')}</th>
                  <th className="py-3 px-4 text-right">{t('remainingDue', 'Due Balance')}</th>
                  <th className="py-3 px-4 text-center">{t('status', 'Status')}</th>
                  <th className="py-3 px-4 text-right">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const customerName = typeof inv.customerId === 'object' ? inv.customerId?.name : 'Customer';
                  const isReversed = inv.status === 'REVERSED';
                  const isPaid = inv.isFullyPaid;
                  const isPartial = inv.isPartiallyPaid;

                  return (
                    <tr
                      key={inv._id}
                      className={`hover:bg-slate-50/60 transition-colors ${isReversed ? 'opacity-60 bg-slate-50' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(inv.transactionDate)}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{customerName}</span>
                        <span className="text-[11px] text-slate-400">
                          {inv.items?.length || 0} {isGujarati ? 'ચીજવસ્તુઓ' : `item${inv.items?.length === 1 ? '' : 's'}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                        {formatINR(inv.totalAmountRupees)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                        {formatINR(inv.allocatedAmountRupees || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {formatINR(inv.remainingBalanceRupees || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isReversed ? (
                          <Badge variant="rose">{t('reversed', 'Voided')}</Badge>
                        ) : isPaid ? (
                          <Badge variant="emerald">{t('paid', 'Fully Paid')}</Badge>
                        ) : isPartial ? (
                          <Badge variant="amber">{t('partial', 'Partially Paid')}</Badge>
                        ) : (
                          <Badge variant="rose">{t('unpaid', 'Unpaid Due')}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewInvoice(inv)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isGujarati ? 'જુઓ' : 'View'}</span>
                        </button>
                        {isAdmin && !isReversed && (
                          <button
                            type="button"
                            onClick={() => {
                              setReversalInvoice(inv);
                              setReversalReason('');
                              setReversalError('');
                            }}
                            title={t('reverseInvoice', 'Reverse Invoice')}
                            className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{t('reverseInvoice', 'Reverse')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View & Print Invoice Modal */}
      <InvoicePrintModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
      />

      {/* Invoice Reversal Authorization Dialog */}
      <Modal
        isOpen={!!reversalInvoice}
        onClose={() => setReversalInvoice(null)}
        title={isGujarati ? 'બિલ રદ કરવાની ખાતરી (Void Authorization)' : 'Authorize Invoice Reversal'}
        maxWidth="md"
      >
        {reversalInvoice && (
          <form onSubmit={handleConfirmReversal} className="space-y-4 text-xs">
            {reversalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {reversalError}
              </div>
            )}
            <p className="text-slate-600">
              {isGujarati
                ? `શું તમે ખરેખર બિલ ${reversalInvoice.invoiceNumber} રદ કરવા માંગો છો? આનાથી ગ્રાહક ખાતામાંથી ₹${reversalInvoice.totalAmountRupees.toFixed(2)} ની ઉધાર રકમ રદ થશે.`
                : `Are you sure you want to reverse Invoice #${reversalInvoice.invoiceNumber}? This will void the invoice and reverse ₹${reversalInvoice.totalAmountRupees.toFixed(2)} in customer credit.`}
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('reversalReason', 'Reason for Cancellation')} *
              </label>
              <textarea
                required
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder={isGujarati ? 'દા.ત. માલ પરત આવ્યો અથવા બિલિંગમાં ભૂલ' : 'e.g. Products returned or incorrect customer billed'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalInvoice(null)}
                className="px-3 py-1.5 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={reversalLoading}
                className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {reversalLoading ? t('loading', 'Reversing...') : t('confirmReverse', 'Confirm Reversal')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
