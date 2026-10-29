import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Receipt,
  RotateCcw,
  Download,
  Filter,
  CreditCard,
  Eye,
} from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { PaymentRecord } from '../../types';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ReceiptModal } from '../../components/ReceiptModal';
import { Modal } from '../../components/Modal';
import { formatINR, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const PaymentsList: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  // Reversal dialog
  const [reversalPayment, setReversalPayment] = useState<PaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState('');

  const { isAdmin } = useAuth();
  const { t, isGujarati } = useLanguage();
  const navigate = useNavigate();

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await paymentService.getPayments({
        search: search.trim() || undefined,
        paymentMethod: methodFilter && methodFilter !== 'ALL' ? methodFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      });
      setPayments(res.data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPayments();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, methodFilter, statusFilter]);

  const handleExportCSV = () => {
    const headers = isGujarati
      ? ['પહોંચ નં.', 'તારીખ', 'ગ્રાહક', 'મળેલ રકમ (₹)', 'ફાળવેલ રકમ (₹)', 'બિન-ફાળવેલ (₹)', 'પદ્ધતિ', 'સંદર્ભ']
      : ['Receipt No', 'Date', 'Customer', 'Amount (₹)', 'Allocated (₹)', 'Unallocated (₹)', 'Method', 'Reference'];

    const rows = payments.map((p) => {
      const customerName = typeof p.customerId === 'object' ? p.customerId?.name : 'Customer';
      return [
        p.receiptNumber,
        formatDate(p.paymentDate),
        customerName,
        p.amountRupees,
        p.allocatedAmountRupees || 0,
        p.unallocatedAmountRupees || 0,
        p.paymentMethod,
        p.referenceNumber || '',
      ];
    });
    exportToCSV(`payments_report_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment || !reversalReason.trim()) return;

    setReversalLoading(true);
    setReversalError('');
    try {
      await paymentService.reversePayment(reversalPayment._id, reversalReason.trim());
      setReversalPayment(null);
      setReversalReason('');
      fetchPayments();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || (isGujarati ? 'ચુકવણી રદ કરવામાં ભૂલ આવી' : 'Failed to reverse payment');
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('payments', 'Payment Records')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {isGujarati
              ? 'રોકડ, યુપીઆઈ અને બેંક મારફત મળેલ જમા રકમ અને ખાતાવહી પાવતીઓ.'
              : 'Cash, UPI, and bank receipts with automated Khata credit ledger allocation.'}
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
            onClick={() => navigate('/payments/new')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('quickReceive', 'Receive Payment')}</span>
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
            placeholder={isGujarati ? 'પહોંચ નંબર, સંદર્ભ અથવા ગ્રાહક નામથી શોધો...' : 'Search by receipt number (e.g. RCP-0001) or customer name...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-700"
          >
            <option value="">{isGujarati ? 'બધી પદ્ધતિઓ (All Modes)' : 'All Modes'}</option>
            <option value="CASH">{t('cash', 'Cash')}</option>
            <option value="UPI">{t('upi', 'UPI')}</option>
            <option value="BANK_TRANSFER">{t('bankTransfer', 'Bank Transfer')}</option>
            <option value="CHEQUE">{t('cheque', 'Cheque')}</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={isGujarati ? 'કોઈ જમા પાવતી મળેલ નથી' : 'No payments found'}
          description={isGujarati ? 'ગ્રાહક પાસેથી મળેલ રકમની પ્રથમ પાવતી નોંધો.' : 'Record your first customer payment collection.'}
          actionLabel={t('quickReceive', 'Receive Payment Now')}
          onAction={() => navigate('/payments/new')}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('receiptNo', 'Receipt No')}</th>
                  <th className="py-3 px-4">{t('date', 'Date')}</th>
                  <th className="py-3 px-4">{t('customerFullName', 'Customer')}</th>
                  <th className="py-3 px-4">{t('paymentModeLabel', 'Method')}</th>
                  <th className="py-3 px-4 text-right">{t('amountReceived', 'Amount Received')}</th>
                  <th className="py-3 px-4 text-right">{t('allocatedAmount', 'Allocated to Invoices')}</th>
                  <th className="py-3 px-4 text-right">{t('unallocatedCredit', 'Unallocated Credit')}</th>
                  <th className="py-3 px-4 text-right">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const customerName = typeof p.customerId === 'object' ? p.customerId?.name : 'Customer';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{customerName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="blue">{p.paymentMethod}</Badge>
                        {p.referenceNumber && (
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{p.referenceNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">
                        +{formatINR(p.amountRupees)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {p.allocatedAmountRupees > 0 ? formatINR(p.allocatedAmountRupees) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.unallocatedAmountRupees > 0 ? (
                          <span className="font-bold text-sky-600">{formatINR(p.unallocatedAmountRupees)}</span>
                        ) : (
                          <span className="text-slate-400">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(p)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isGujarati ? 'જુઓ' : 'Receipt'}</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setReversalPayment(p);
                              setReversalReason('');
                              setReversalError('');
                            }}
                            title={t('reverseInvoice', 'Reverse Receipt')}
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

      {/* View & Print Receipt Modal */}
      <ReceiptModal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />

      {/* Payment Reversal Authorization Dialog */}
      <Modal
        isOpen={!!reversalPayment}
        onClose={() => setReversalPayment(null)}
        title={isGujarati ? 'પહોંચ રદ કરવાની ખાતરી (Delete Payment)' : 'Authorize Payment Reversal'}
        maxWidth="md"
      >
        {reversalPayment && (
          <form onSubmit={handleConfirmReversal} className="space-y-4 text-xs">
            {reversalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {reversalError}
              </div>
            )}
            <p className="text-slate-600">
              {isGujarati
                ? `શું તમે ખરેખર પહોંચ ${reversalPayment.receiptNumber} રદ કરવા માંગો છો? આનાથી ગ્રાહક ખાતામાં ₹${reversalPayment.amountRupees.toFixed(2)} ની જમા રકમ ફરીથી બાકી થઈ જશે.`
                : `Are you sure you want to reverse Receipt #${reversalPayment.receiptNumber}? This will remove ₹${reversalPayment.amountRupees.toFixed(2)} in credited payments and restore customer balance.`}
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
                placeholder={isGujarati ? 'દા.ત. ચેક બાઉન્સ થયો અથવા ખોટી એન્ટ્રી' : 'e.g. Cheque bounced or duplicate entry'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalPayment(null)}
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
