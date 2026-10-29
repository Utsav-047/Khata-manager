import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  CreditCard,
  PlusCircle,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { transactionService } from '../../services/transactionService';
import { paymentService } from '../../services/paymentService';
import { Customer, LedgerEntry, TransactionInvoice, PaymentRecord } from '../../types';
import { Badge } from '../../components/Badge';
import { InvoicePrintModal } from '../../components/InvoicePrintModal';
import { ReceiptModal } from '../../components/ReceiptModal';
import { formatINR, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';
import { useLanguage } from '../../context/LanguageContext';

export const CustomerLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, isGujarati } = useLanguage();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals for viewing specific entries
  const [viewInvoice, setViewInvoice] = useState<TransactionInvoice | null>(null);
  const [viewPayment, setViewPayment] = useState<PaymentRecord | null>(null);

  const fetchLedger = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await customerService.getCustomerLedger(id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setCustomer(data.customer);
      setSummary(data.summary);
      setLedger(data.ledger || []);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [id, startDate, endDate]);

  const handleExportCSV = () => {
    if (!customer) return;
    const headers = isGujarati
      ? ['ક્રમ', 'તારીખ', 'સંદર્ભ નં.', 'વિગત', 'પ્રકાર', 'ઉધાર (₹)', 'જમા (₹)', 'ચાલુ બાકી (₹)', 'સ્ટાફ']
      : ['Sr', 'Date', 'Reference', 'Description', 'Type', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)', 'Staff'];

    const rows = ledger.map((entry) => [
      entry.srNo,
      formatDate(entry.date),
      entry.refNumber,
      entry.description,
      entry.type,
      entry.debitRupees || '',
      entry.creditRupees || '',
      entry.runningBalanceRupees,
      entry.createdBy,
    ]);
    exportToCSV(`${customer.customerCode}_ledger_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleRowClick = async (entry: LedgerEntry) => {
    if (entry.entityType === 'Transaction' && entry.refId) {
      try {
        const inv = await transactionService.getTransactionById(entry.refId);
        setViewInvoice(inv);
      } catch (err) {
        console.error('Failed to load invoice:', err);
      }
    } else if (entry.entityType === 'Payment' && entry.refId) {
      try {
        const pay = await paymentService.getPaymentById(entry.refId);
        setViewPayment(pay);
      } catch (err) {
        console.error('Failed to load payment:', err);
      }
    }
  };

  if (loading && !customer) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">{t('loading', 'Loading...')}</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-rose-500">Customer account not found.</div>;
  }

  const bal = summary?.currentBalance ?? summary?.closingBalance ?? customer.outstandingBalanceRupees ?? 0;
  const hasDue = bal > 0;
  const isAdvance = bal < 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between no-print">
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isGujarati ? 'ગ્રાહક યાદી પર પાછા જાઓ' : 'Back to Customers'}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('exportCSV', 'Export CSV')}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('printStatement', 'Print Statement')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/payments/new?customerId=${customer._id}`)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-sm transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{t('quickReceive', 'Receive Payment')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/invoices/new?customerId=${customer._id}`)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('quickSale', 'New Credit Sale')}</span>
          </button>
        </div>
      </div>

      <div id="printable-area" className="space-y-6">
        {/* Customer Header Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                  {customer.customerCode}
                </span>
                <Badge variant={customer.isActive ? 'emerald' : 'slate'}>
                  {customer.isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                <span>{t('mobileLabel', 'Mobile')}: {customer.mobile || '-'}</span>
                {customer.address && <span>{t('addressLabel', 'Address')}: {customer.address}</span>}
              </div>
            </div>

            {/* Current Balance Hero Badge */}
            <div className="p-3 px-5 rounded-xl bg-slate-50 border border-slate-200 text-right">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {t('netOutstanding', 'Net Outstanding Balance')}
              </span>
              <span
                className={`text-2xl font-extrabold ${
                  hasDue ? 'text-rose-600' : isAdvance ? 'text-blue-600' : 'text-emerald-600'
                }`}
              >
                {formatINR(Math.abs(bal))}
              </span>
              <span className="text-[10px] text-slate-500 block font-medium">
                {hasDue
                  ? t('customerOwes', 'Customer Owes Money')
                  : isAdvance
                  ? t('advanceDeposited', 'Advance Credit Deposited')
                  : t('accountSettled', 'Account Fully Settled (₹0.00 Balance)')}
              </span>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">{t('openingBalance', 'Opening Balance')}:</span>
              <span className="font-semibold text-slate-800">{formatINR(summary?.openingBalance ?? customer.openingBalanceRupees ?? 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">{t('totalDebits', 'Total Credit Purchases')}:</span>
              <span className="font-semibold text-rose-600">{formatINR(summary?.totalDebits ?? 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">{t('totalCredits', 'Total Payments Made')}:</span>
              <span className="font-semibold text-emerald-600">{formatINR(summary?.totalCredits ?? 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">{t('unallocatedCredits', 'Unallocated Credits')}:</span>
              <span className="font-semibold text-slate-700">{formatINR(0)}</span>
            </div>
          </div>
        </div>

        {/* Date Filter Bar (Hidden on Print) */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3 text-xs no-print">
          <span className="font-semibold text-slate-700 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('filterStatement', 'Filter Statement:')}</span>
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-emerald-600 hover:text-emerald-700 font-medium px-2"
              >
                {t('clear', 'Clear')}
              </button>
            )}
          </div>
        </div>

        {/* Passbook / Ledger Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {t('ledgerTitle', 'Transaction Ledger & Running Balance')}
            </h3>
            <span className="text-[11px] text-slate-500">
              {ledger.length} {t('entriesRecorded', 'Entries Recorded')}
            </span>
          </div>

          {/* Mobile Statement Cards View (< 768px) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {ledger.map((entry) => {
              const isDebit = entry.type === 'DEBIT' && entry.debitRupees > 0;
              const isCredit = entry.type === 'CREDIT' && entry.creditRupees > 0;
              const isReversed = entry.status === 'REVERSED';

              return (
                <div
                  key={entry.srNo}
                  onClick={() => handleRowClick(entry)}
                  className={`p-3.5 space-y-2 cursor-pointer ${
                    isReversed ? 'opacity-60 bg-slate-50 line-through' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        {entry.type === 'DEBIT' && <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        {entry.type === 'CREDIT' && <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        <span className="font-mono font-bold text-slate-900 text-xs">{entry.refNumber}</span>
                        <span className="text-[10px] text-slate-400">#{entry.srNo}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {formatDate(entry.date)} • {entry.type === 'OPENING' ? (isGujarati ? 'શરૂઆતની બાકી રકમ' : 'Opening Balance') : entry.description}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      {isDebit && (
                        <span className="font-bold text-rose-600 text-xs block">
                          +{formatINR(entry.debitRupees)}
                        </span>
                      )}
                      {isCredit && (
                        <span className="font-bold text-emerald-600 text-xs block">
                          -{formatINR(entry.creditRupees)}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Bal: {formatINR(entry.runningBalanceRupees)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">{t('srNo', '#')}</th>
                  <th className="py-2.5 px-3 w-24">{t('date', 'Date')}</th>
                  <th className="py-2.5 px-3 w-28">{t('refNo', 'Ref No.')}</th>
                  <th className="py-2.5 px-3">{t('description', 'Description')}</th>
                  <th className="py-2.5 px-3 text-right text-rose-700 font-bold w-28">{t('debit', 'Debit (Sale)')}</th>
                  <th className="py-2.5 px-3 text-right text-emerald-700 font-bold w-28">{t('credit', 'Credit (Payment)')}</th>
                  <th className="py-2.5 px-3 text-right text-slate-900 font-bold w-32">{t('runningBalance', 'Running Balance')}</th>
                  <th className="py-2.5 px-3 w-24 text-slate-500">{t('user', 'User')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry) => {
                  const isDebit = entry.type === 'DEBIT' && entry.debitRupees > 0;
                  const isCredit = entry.type === 'CREDIT' && entry.creditRupees > 0;
                  const isReversed = entry.status === 'REVERSED';

                  return (
                    <tr
                      key={entry.srNo}
                      onClick={() => handleRowClick(entry)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        isReversed ? 'opacity-60 bg-slate-50/50 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">{entry.srNo}</td>
                      <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <span className="hover:underline flex items-center space-x-1">
                          {entry.type === 'DEBIT' && <ArrowUpRight className="w-3 h-3 text-rose-500 shrink-0" />}
                          {entry.type === 'CREDIT' && <ArrowDownLeft className="w-3 h-3 text-emerald-500 shrink-0" />}
                          <span>{entry.refNumber}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {entry.type === 'OPENING' ? (isGujarati ? 'શરૂઆતની બાકી રકમ' : 'Opening Balance') : entry.description}
                        {entry.reversalReason && (
                          <span className="block text-[11px] text-rose-500 font-medium">
                            Reason: {entry.reversalReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        {isDebit ? formatINR(entry.debitRupees) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {isCredit ? formatINR(entry.creditRupees) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap text-sm">
                        {formatINR(entry.runningBalanceRupees)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">{entry.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Details Modal */}
      <InvoicePrintModal
        isOpen={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        invoice={viewInvoice}
      />

      {/* Receipt Details Modal */}
      <ReceiptModal
        isOpen={!!viewPayment}
        onClose={() => setViewPayment(null)}
        payment={viewPayment}
      />
    </div>
  );
};
