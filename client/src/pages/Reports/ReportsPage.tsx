import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Wallet,
  Clock,
  CreditCard,
  Layers,
  Filter,
} from 'lucide-react';
import { reportService } from '../../services/reportService';
import { formatINR, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';
import { useLanguage } from '../../context/LanguageContext';

export const ReportsPage: React.FC = () => {
  const { t, isGujarati } = useLanguage();
  const [activeTab, setActiveTab] = useState<'outstanding' | 'collections' | 'aging' | 'unallocated'>('outstanding');
  const [loading, setLoading] = useState(false);

  // Outstanding Report State
  const [outstandingData, setOutstandingData] = useState<any>(null);
  const [outstandingFilter, setOutstandingFilter] = useState('with_balance');

  // Collections Report State
  const [collectionsData, setCollectionsData] = useState<any>(null);
  const [collectionMethod, setCollectionMethod] = useState('ALL');
  const [collectionStart, setCollectionStart] = useState('');
  const [collectionEnd, setCollectionEnd] = useState('');

  // Aging Report State
  const [agingData, setAgingData] = useState<any>(null);

  // Unallocated Report State
  const [unallocatedData, setUnallocatedData] = useState<any>(null);

  useEffect(() => {
    loadTabReport(activeTab);
  }, [activeTab, outstandingFilter, collectionMethod, collectionStart, collectionEnd]);

  const loadTabReport = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'outstanding') {
        const res = await reportService.getOutstandingReport(outstandingFilter);
        setOutstandingData(res);
      } else if (tab === 'collections') {
        const res = await reportService.getCollectionsReport({
          paymentMethod: collectionMethod,
          startDate: collectionStart || undefined,
          endDate: collectionEnd || undefined,
        });
        setCollectionsData(res);
      } else if (tab === 'aging') {
        const res = await reportService.getAgingReport();
        setAgingData(res);
      } else if (tab === 'unallocated') {
        const res = await reportService.getUnallocatedReport();
        setUnallocatedData(res);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportOutstandingCSV = () => {
    if (!outstandingData?.rows) return;
    const headers = isGujarati
      ? ['કોડ', 'ગ્રાહક નામ', 'મોબાઈલ', 'શરૂઆત બાકી (₹)', 'ઉધાર ખરીદી (₹)', 'જમા ચુકવણી (₹)', 'ચોખ્ખી બાકી રકમ (₹)', 'સ્થિતિ']
      : ['Code', 'Customer Name', 'Mobile', 'Opening (₹)', 'Debits (₹)', 'Payments (₹)', 'Outstanding Balance (₹)', 'Status'];

    const rows = outstandingData.rows.map((r: any) => [
      r.customerCode,
      r.name,
      r.mobile,
      r.openingBalanceRupees,
      r.totalDebitsRupees,
      r.totalPaymentsRupees,
      r.outstandingBalanceRupees,
      r.isSettled ? (isGujarati ? 'ચુકતે' : 'Settled') : (isGujarati ? 'બાકી' : 'Due'),
    ]);
    exportToCSV(`outstanding_report_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const exportCollectionsCSV = () => {
    if (!collectionsData?.rows) return;
    const headers = isGujarati
      ? ['પહોંચ નં.', 'તારીખ', 'ગ્રાહક', 'મોબાઈલ', 'રકમ (₹)', 'પદ્ધતિ', 'સંદર્ભ', 'સ્ટાફ']
      : ['Receipt No', 'Date', 'Customer', 'Mobile', 'Amount (₹)', 'Method', 'Reference', 'Staff'];

    const rows = collectionsData.rows.map((r: any) => [
      r.receiptNumber,
      formatDate(r.paymentDate),
      r.customerName,
      r.mobile,
      r.amountRupees,
      r.paymentMethod,
      r.referenceNumber,
      r.createdBy,
    ]);
    exportToCSV(`collections_report_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const exportUnallocatedCSV = () => {
    if (!unallocatedData?.rows) return;
    const headers = isGujarati
      ? ['પહોંચ નં.', 'તારીખ', 'ગ્રાહક', 'કુલ રકમ (₹)', 'ફાળવેલ (₹)', 'બિન-ફાળવેલ જમા (₹)', 'પદ્ધતિ']
      : ['Receipt No', 'Date', 'Customer', 'Total Amount (₹)', 'Allocated (₹)', 'Unallocated Credit (₹)', 'Method'];

    const rows = unallocatedData.rows.map((r: any) => [
      r.receiptNumber,
      formatDate(r.paymentDate),
      r.customerName,
      r.totalAmountRupees,
      r.allocatedAmountRupees,
      r.unallocatedAmountRupees,
      r.paymentMethod,
    ]);
    exportToCSV(`unallocated_credits_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('reportsTitle', 'Financial Reports & Ledger Analysis')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('reportsSubtitle', 'Customer outstanding, collection breakdown, unallocated credits, and aging buckets.')}
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 flex space-x-2 sm:space-x-4 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('outstanding')}
          className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'outstanding'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{t('debtorsTab', 'Customer Outstanding')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'collections'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{t('collectionsTab', 'Collections Summary')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aging')}
          className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'aging'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('agingTab', 'Debt Aging Schedule')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unallocated')}
          className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'unallocated'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('unallocatedTab', 'Unallocated Payments')}</span>
        </button>
      </div>

      {/* TAB 1: Outstanding Report */}
      {activeTab === 'outstanding' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-700">{isGujarati ? 'ખાતા ફિલ્ટર:' : 'Filter Accounts:'}</span>
              <select
                value={outstandingFilter}
                onChange={(e) => setOutstandingFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
              >
                <option value="with_balance">{t('customersWithBalanceDueOption', 'Customers with Balance Due (Debtors)')}</option>
                <option value="all">{t('allActiveCustomers', 'All Active Customers')}</option>
                <option value="settled">{t('fullySettledOption', 'Fully Settled Accounts (Zero Balance)')}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={exportOutstandingCSV}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('exportCSV', 'Export CSV')}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                {t('displayingAccounts', 'Displaying accounts')}: <strong>{outstandingData?.totalCustomers || 0}</strong>
              </span>
              <div className="text-right">
                <span className="text-slate-500 block">{t('totalOutstandingNet', 'Total Outstanding Balance')}:</span>
                <span className="text-base font-extrabold text-rose-600">
                  {formatINR(outstandingData?.totalOutstandingRupees || 0)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{t('customerCode', 'Code')}</th>
                    <th className="py-2.5 px-3">{t('customerFullName', 'Customer')}</th>
                    <th className="py-2.5 px-3">{t('customerMobile', 'Mobile')}</th>
                    <th className="py-2.5 px-3 text-right">{t('openingBalance', 'Opening Balance')}</th>
                    <th className="py-2.5 px-3 text-right">{t('totalDebits', 'Total Debits')}</th>
                    <th className="py-2.5 px-3 text-right">{t('totalCredits', 'Total Paid')}</th>
                    <th className="py-2.5 px-3 text-right">{t('balanceDue', 'Outstanding Balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">{t('loading', 'Loading report...')}</td>
                    </tr>
                  ) : outstandingData?.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isGujarati ? 'કોઈ રેકોર્ડ મળેલ નથી.' : 'No customer records match this filter.'}
                      </td>
                    </tr>
                  ) : (
                    outstandingData?.rows?.map((row: any) => (
                      <tr key={row.customerId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{row.customerCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{row.mobile || '-'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatINR(row.openingBalanceRupees)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatINR(row.totalDebitsRupees)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                          {formatINR(row.totalPaymentsRupees)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          {formatINR(row.outstandingBalanceRupees)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Collections Report */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">{t('paymentModeLabel', 'Method')}:</span>
              <select
                value={collectionMethod}
                onChange={(e) => setCollectionMethod(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">{isGujarati ? 'બધી પદ્ધતિઓ (All Modes)' : 'All Modes'}</option>
                <option value="CASH">{t('cash', 'Cash Only')}</option>
                <option value="UPI">{t('upi', 'UPI Only')}</option>
                <option value="BANK_TRANSFER">{t('bankTransfer', 'Bank Transfer Only')}</option>
                <option value="CHEQUE">{t('cheque', 'Cheque Only')}</option>
              </select>

              <span className="text-slate-400 ml-2">{t('date', 'Dates')}:</span>
              <input
                type="date"
                value={collectionStart}
                onChange={(e) => setCollectionStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={collectionEnd}
                onChange={(e) => setCollectionEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded"
              />
            </div>
            <button
              type="button"
              onClick={exportCollectionsCSV}
              className="inline-flex items-center space-x-1 px-3 py-1.5 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('exportCSV', 'Export CSV')}</span>
            </button>
          </div>

          {/* Breakdown KPI boxes */}
          {collectionsData?.breakdownByMethod && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 block font-medium">{t('cash', 'Cash Collected')}</span>
                <span className="text-base font-bold text-slate-900">
                  {formatINR(collectionsData.breakdownByMethod.cashRupees)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 block font-medium">{t('upi', 'UPI Collected')}</span>
                <span className="text-base font-bold text-sky-600">
                  {formatINR(collectionsData.breakdownByMethod.upiRupees)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 block font-medium">{t('bankTransfer', 'Bank Transfer')}</span>
                <span className="text-base font-bold text-indigo-600">
                  {formatINR(collectionsData.breakdownByMethod.bankTransferRupees)}
                </span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-800 block font-bold">{t('todayCollections', 'Total Collection')}</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {formatINR(collectionsData.totalCollectedRupees)}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{t('receiptNo', 'Receipt No')}</th>
                    <th className="py-2.5 px-3">{t('date', 'Date')}</th>
                    <th className="py-2.5 px-3">{t('customerFullName', 'Customer')}</th>
                    <th className="py-2.5 px-3">{t('paymentModeLabel', 'Method')}</th>
                    <th className="py-2.5 px-3">{t('referenceNumber', 'Reference / UTR')}</th>
                    <th className="py-2.5 px-3 text-right">{t('amountReceived', 'Amount')}</th>
                    <th className="py-2.5 px-3">{t('user', 'Staff')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">{t('loading', 'Loading collections...')}</td>
                    </tr>
                  ) : collectionsData?.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isGujarati ? 'પસંદ કરેલ તારીખોમાં કોઈ વસૂલાત નોંધાયેલ નથી.' : 'No payment collections found in this date range.'}
                      </td>
                    </tr>
                  ) : (
                    collectionsData?.rows?.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{row.receiptNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDate(row.paymentDate)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.customerName}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{row.paymentMethod}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{row.referenceNumber || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {formatINR(row.amountRupees)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{row.createdBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Debt Aging Analysis */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-semibold text-emerald-600 block uppercase tracking-wider">0–30 Days</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {formatINR(agingData?.days0To30Rupees || 0)}
              </span>
              <span className="text-[11px] text-slate-400">{isGujarati ? 'ચાલુ બિલિંગ સાયકલ' : 'Current billing cycle'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-semibold text-amber-600 block uppercase tracking-wider">31–60 Days</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {formatINR(agingData?.days31To60Rupees || 0)}
              </span>
              <span className="text-[11px] text-slate-400">{isGujarati ? 'સામાન્ય મુદત વીતી ગયેલ' : 'Past standard grace period'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-semibold text-orange-600 block uppercase tracking-wider">61–90 Days</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {formatINR(agingData?.days61To90Rupees || 0)}
              </span>
              <span className="text-[11px] text-slate-400">{isGujarati ? 'યાદ અપાવવાની જરૂર છે' : 'Requires follow-up reminder'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 text-center">
              <span className="text-xs font-semibold text-rose-600 block uppercase tracking-wider">Over 90 Days</span>
              <span className="text-xl font-bold text-rose-700 mt-1 block">
                {formatINR(agingData?.daysOver90Rupees || 0)}
              </span>
              <span className="text-[11px] text-rose-500 font-medium">{isGujarati ? 'અતિ ગંભીર બાકી રકમ' : 'Critical overdue balance'}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed text-slate-600">
            <h4 className="font-bold text-slate-900 text-sm mb-2">{isGujarati ? 'ખાતાવહી અને એજિંગ ગણતરી પદ્ધતિ' : 'Aging Policy & Accounting Note'}</h4>
            <p>
              {isGujarati
                ? 'બાકી મુદત (Aging) ની ગણતરી અવેતન ઉધાર બિલની મૂળ તારીખ અનુસાર થાય છે. મોડ ૨ બિલ-વાઇઝ ચુકવણીથી સીધું બિલનું દેવું ઘટે છે, જ્યારે મોડ ૧ ની સામાન્ય જમા રકમ ગ્રાહકના ખાતામાં જનરલ ક્રેડિટ તરીકે જમા રહે છે.'
                : 'Aging calculations are based strictly on original invoice transaction dates for unpaid/partially paid credit invoices. Mode 2 invoice-wise payment allocations reduce specific invoice debt directly. Unallocated Mode 1 payments act as general account credit.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: Unallocated Payments */}
      {activeTab === 'unallocated' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600">
              {isGujarati ? 'ચોક્કસ બિલ સાથે ફાળવવાની બાકી હોય તેવી જમા પાવતીઓ:' : 'Receipts containing payment amounts not yet assigned to individual invoices:'}{' '}
              <strong className="text-slate-900">{unallocatedData?.count || 0}</strong>
            </span>
            <button
              type="button"
              onClick={exportUnallocatedCSV}
              className="inline-flex items-center space-x-1 px-3 py-1.5 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('exportCSV', 'Export CSV')}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{t('receiptNo', 'Receipt No')}</th>
                    <th className="py-2.5 px-3">{t('date', 'Date')}</th>
                    <th className="py-2.5 px-3">{t('customerFullName', 'Customer')}</th>
                    <th className="py-2.5 px-3">{t('paymentModeLabel', 'Method')}</th>
                    <th className="py-2.5 px-3 text-right">{t('amountReceived', 'Total Payment')}</th>
                    <th className="py-2.5 px-3 text-right">{t('allocatedAmount', 'Allocated')}</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-700">{t('unallocatedCredit', 'Unallocated Credit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">{t('loading', 'Loading unallocated credits...')}</td>
                    </tr>
                  ) : unallocatedData?.rows?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isGujarati ? 'બધી જમા પાવતીઓ બિલો સાથે ફાળવેલ છે.' : 'All customer payment receipts are fully allocated to invoices.'}
                      </td>
                    </tr>
                  ) : (
                    unallocatedData?.rows?.map((row: any) => (
                      <tr key={row.paymentId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{row.receiptNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDate(row.paymentDate)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{row.paymentMethod}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{formatINR(row.totalAmountRupees)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatINR(row.allocatedAmountRupees)}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600">
                          {formatINR(row.unallocatedAmountRupees)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
