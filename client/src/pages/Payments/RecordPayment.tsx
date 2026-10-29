import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { transactionService } from '../../services/transactionService';
import { paymentService } from '../../services/paymentService';
import { Customer, TransactionInvoice, PaymentRecord } from '../../types';
import { ReceiptModal } from '../../components/ReceiptModal';
import { formatINR, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';

export const RecordPayment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';
  const { t, isGujarati } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Mode Selection: 'simple' vs 'invoice_wise'
  const [paymentMode, setPaymentMode] = useState<'simple' | 'invoice_wise'>('simple');

  // Customer Invoices available for allocation
  const [unpaidInvoices, setUnpaidInvoices] = useState<TransactionInvoice[]>([]);
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});

  const [loading, setLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedPayment, setSavedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await customerService.getCustomers({ limit: 200 });
        setCustomers(res.data || []);
        if (preselectedCustomerId && res.data) {
          const match = res.data.find((c: Customer) => c._id === preselectedCustomerId);
          if (match) {
            setSelectedCustomerId(match._id);
            setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    };
    loadCustomers();
  }, [preselectedCustomerId]);

  // When customer changes, load their unpaid invoices
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }

    const loadCustomerInvoices = async () => {
      setInvoicesLoading(true);
      try {
        const [cDetail, invRes] = await Promise.all([
          customerService.getCustomerById(selectedCustomerId),
          transactionService.getTransactions({ customerId: selectedCustomerId, status: 'unpaid', limit: 100 }),
        ]);
        setSelectedCustomer(cDetail);

        // Filter invoices that still have unpaid balance
        const openInvoices = (invRes.data || []).filter(
          (inv: TransactionInvoice) => (inv.remainingBalanceRupees || 0) > 0
        );
        setUnpaidInvoices(openInvoices);
        setAllocations({});
      } catch (err) {
        console.error('Failed to load customer details:', err);
      } finally {
        setInvoicesLoading(false);
      }
    };
    loadCustomerInvoices();
  }, [selectedCustomerId]);

  const handleAllocationChange = (invoiceId: string, val: number) => {
    setAllocations({
      ...allocations,
      [invoiceId]: Math.max(0, val),
    });
  };

  const handleAllocateFull = (inv: TransactionInvoice) => {
    const remainingToPay = inv.remainingBalanceRupees || 0;
    setAllocations({
      ...allocations,
      [inv._id]: remainingToPay,
    });
  };

  // Total allocated sum in invoice-wise mode
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  const unallocatedRemainder = Math.max(0, Number((amount - totalAllocated).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError(isGujarati ? 'કૃપા કરીને ગ્રાહક પસંદ કરો' : 'Please select a customer');
      return;
    }
    if (amount <= 0) {
      setError(isGujarati ? 'ચુકવણીની રકમ શૂન્યથી વધુ હોવી જોઈએ' : 'Payment amount must be greater than zero');
      return;
    }

    if (paymentMode === 'invoice_wise') {
      if (totalAllocated > amount) {
        setError(
          isGujarati
            ? `કુલ ફાળવેલ રકમ (₹${totalAllocated}) મળેલ રકમ (₹${amount}) કરતાં વધુ ન હોઈ શકે`
            : `Total allocated amount (₹${totalAllocated}) cannot exceed payment amount (₹${amount})`
        );
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Build allocation payload if mode is invoice_wise
      const formattedAllocations =
        paymentMode === 'invoice_wise'
          ? Object.entries(allocations)
              .filter(([_, allocAmt]) => allocAmt > 0)
              .map(([invId, allocAmt]) => ({
                invoiceId: invId,
                allocatedAmount: allocAmt,
              }))
          : [];

      const res = await paymentService.createPayment({
        customerId: selectedCustomerId,
        paymentDate,
        amount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() ? referenceNumber.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        allocations: formattedAllocations,
      });

      setSavedPayment(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || (isGujarati ? 'ચુકવણી નોંધવામાં ભૂલ આવી' : 'Failed to record payment');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back', 'Back')}</span>
        </button>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('quickReceive', 'Receive Payment')}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Amount Selection Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            {isGujarati ? '૧. ગ્રાહક અને ચુકવણીની રકમ' : '1. Customer & Amount Received'}
          </h3>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('customerFullName', 'Customer Account')} *
              </label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
              >
                <option value="">{isGujarati ? '-- ગ્રાહક પસંદ કરો --' : '-- Choose Customer --'}</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.customerCode}) {c.mobile ? `- ${c.mobile}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('date', 'Payment Date')} *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Customer Balance Strip */}
          {selectedCustomer && (
            <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200/80 flex flex-wrap items-center justify-between text-xs gap-2">
              <div>
                <span className="text-emerald-900 font-semibold">{selectedCustomer.name}</span>
                <span className="text-emerald-700 font-mono ml-1">({selectedCustomer.customerCode})</span>
              </div>
              <div>
                <span className="text-emerald-800">{t('balanceDue', 'Current Balance')}:</span>{' '}
                <strong className={`font-bold text-sm ${selectedCustomer.outstandingBalanceRupees > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatINR(selectedCustomer.outstandingBalanceRupees)}
                </strong>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('paymentAmount', 'Amount Received (₹)')} *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 2000.00"
                className="w-full px-3 py-2 text-base font-extrabold border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900 text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('paymentModeLabel', 'Payment Method')} *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900 font-medium"
              >
                <option value="CASH">{t('cash', 'Cash Payment')}</option>
                <option value="UPI">{t('upi', 'UPI (Google Pay / PhonePe / Paytm)')}</option>
                <option value="BANK_TRANSFER">{t('bankTransfer', 'Bank Transfer (NEFT / IMPS / RTGS)')}</option>
                <option value="CHEQUE">{t('cheque', 'Bank Cheque')}</option>
                <option value="OTHER">{t('other', 'Other')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('referenceNumber', 'Reference / UTR / Cheque No.')}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UPI/9876543210"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Payment Mode Selection Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            {isGujarati ? '૨. ચુકવણી પદ્ધતિ પસંદ કરો' : '2. Choose Payment Mode'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setPaymentMode('simple')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                paymentMode === 'simple'
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="paymentMode"
                  checked={paymentMode === 'simple'}
                  onChange={() => setPaymentMode('simple')}
                  className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-900">
                  {isGujarati ? 'મોડ ૧: સામાન્ય જમા રકમ' : 'Mode 1: Simple Payment'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {isGujarati
                  ? 'કોઈ ચોક્કસ બિલ સાથે લિંક કર્યા વિના સીધી ગ્રાહકની ખાતા બાકી રકમ ઘટાડે છે.'
                  : "Reduces the customer's total outstanding balance directly without linking to specific invoices."}
              </p>
            </div>

            <div
              onClick={() => setPaymentMode('invoice_wise')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                paymentMode === 'invoice_wise'
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="paymentMode"
                  checked={paymentMode === 'invoice_wise'}
                  onChange={() => setPaymentMode('invoice_wise')}
                  className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-900">
                  {isGujarati ? 'મોડ ૨: બિલ-વાઇઝ ફાળવણી' : 'Mode 2: Invoice-wise Allocation'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {isGujarati
                  ? 'ચોક્કસ ઉધાર બિલો સામે રકમ ફાળવો (દા.ત. બિલ ૧ માં ₹૨,૦૦૦, બિલ ૨ માં ₹૧,૦૦૦) કોઈપણ ડબલ ગણતરી વિના.'
                  : 'Allocate this payment across specific invoices with zero double-counting.'}
              </p>
            </div>
          </div>

          {/* Mode 2: Invoice Selection Table */}
          {paymentMode === 'invoice_wise' && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {isGujarati ? `ગ્રાહકના બાકી બિલો (${unpaidInvoices.length})` : `Open Customer Invoices (${unpaidInvoices.length})`}
                </span>
                <span className="text-xs text-slate-500">
                  {t('allocatedAmount', 'Allocated')}: <strong className="text-slate-900">{formatINR(totalAllocated)}</strong> {isGujarati ? 'માંથી' : 'of'} {formatINR(amount)}
                </span>
              </div>

              {invoicesLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">{t('loading', 'Loading open customer invoices...')}</div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-slate-200">
                  {isGujarati
                    ? 'આ ગ્રાહક માટે કોઈ અવેતન બિલ મળ્યા નથી. કોઈપણ નોંધાયેલી રકમ તેમના ખાતામાં સામાન્ય જમા રહેશે.'
                    : 'No unpaid invoices found for this customer. Any amount recorded will remain as an unallocated credit on their Khata.'}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[500px]">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">{t('invoiceNo', 'Invoice No')}</th>
                        <th className="py-2.5 px-3">{t('date', 'Date')}</th>
                        <th className="py-2.5 px-3 text-right">{t('invoiceTotal', 'Invoice Total')}</th>
                        <th className="py-2.5 px-3 text-right">{t('remainingDue', 'Remaining Due')}</th>
                        <th className="py-2.5 px-3 text-right w-40">{t('allocatedAmount', 'Allocate (₹)')}</th>
                        <th className="py-2.5 px-3 text-right">{t('actions', 'Action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unpaidInvoices.map((inv) => (
                        <tr key={inv._id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-3 text-slate-600">{formatDate(inv.transactionDate)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-700">{formatINR(inv.totalAmountRupees)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                            {formatINR(inv.remainingBalanceRupees)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={inv.remainingBalanceRupees}
                              value={allocations[inv._id] || ''}
                              onChange={(e) => handleAllocationChange(inv._id, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-32 px-2 py-1 text-right text-xs border border-slate-200 rounded font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleAllocateFull(inv)}
                              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                            >
                              {isGujarati ? 'પૂરેપૂરું' : 'Pay Full'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Allocation Summary Strip */}
              <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">{t('unallocatedCredit', 'Unallocated Remainder')}:</span>{' '}
                  <strong className="text-emerald-700">{formatINR(unallocatedRemainder)}</strong>
                  <span className="text-[11px] text-slate-400 block">
                    {isGujarati
                      ? '(વધેલી રકમ આપમેળે ગ્રાહકના ખાતામાં જમા રહેશે)'
                      : "(Any remainder automatically credits customer's general balance)"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">{t('paymentAmount', 'Total Payment')}:</span>
                  <span className="text-sm font-bold text-slate-900">{formatINR(amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Remarks & Submit */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('customerRemarks', 'Payment Remarks / Notes')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isGujarati ? 'દા.ત. ખાતા બાકી ચુકવણી અથવા હપ્તો' : 'e.g. Paid in full for delivery or partial installment'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/payments')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? t('saving', 'Recording Payment...') : (isGujarati ? 'જમા રકમ સાચવો અને પહોંચ બનાવો' : 'Save Payment & Generate Receipt')}
            </button>
          </div>
        </div>
      </form>

      {/* Payment Success & Receipt Modal */}
      <ReceiptModal
        isOpen={!!savedPayment}
        onClose={() => {
          setSavedPayment(null);
          navigate(`/customers/${selectedCustomerId}/ledger`);
        }}
        payment={savedPayment}
      />
    </div>
  );
};
