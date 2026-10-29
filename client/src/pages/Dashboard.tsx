import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  CreditCard,
  Users,
  ArrowUpRight,
  PlusCircle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { reportService } from '../services/reportService';
import { transactionService } from '../services/transactionService';
import { paymentService } from '../services/paymentService';
import { DashboardSummary, TransactionInvoice, PaymentRecord } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { formatINR, formatDate } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';

export const Dashboard: React.FC = () => {
  const { t, isGujarati } = useLanguage();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<TransactionInvoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashData, invData, payData] = await Promise.all([
          reportService.getDashboardSummary(),
          transactionService.getTransactions({ limit: 5 }),
          paymentService.getPayments({ limit: 5 }),
        ]);
        setSummary(dashData);
        setRecentInvoices(invData.data || []);
        setRecentPayments(payData.data || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-72 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  // Aging chart data
  const agingChartData = [
    { name: isGujarati ? '૦-૩૦ દિવસ' : '0-30 Days', amount: summary.aging.days0To30Rupees || 0 },
    { name: isGujarati ? '૩૧-૬૦ દિવસ' : '31-60 Days', amount: summary.aging.days31To60Rupees || 0 },
    { name: isGujarati ? '૬૧-૯૦ દિવસ' : '61-90 Days', amount: summary.aging.days61To90Rupees || 0 },
    { name: isGujarati ? '૯૦+ દિવસ' : '90+ Days', amount: summary.aging.daysOver90Rupees || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('dashboardTitle', 'Financial Overview')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('dashboardSubtitle', 'Real-time balance accounting, credit ledger, and collections overview.')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => navigate('/invoices/new')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('quickSale', 'New Credit Sale')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/payments/new')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>{t('quickReceive', 'Receive Payment')}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('totalOutstanding', 'Total Outstanding Balance')}
          value={formatINR(summary.totalOutstandingBaakiRupees || 0)}
          subtitle={isGujarati ? 'બધા ખાતાઓની ચોખ્ખી બાકી રકમ' : 'Net balance across all accounts'}
          icon={Wallet}
          variant="rose"
        />
        <StatCard
          title={t('todayCollections', "Today's Collections")}
          value={formatINR(summary.todayPaymentsRupees || 0)}
          subtitle={`${t('thisMonth', 'This Month')}: ${formatINR(summary.monthPaymentsRupees || 0)}`}
          icon={CreditCard}
          variant="emerald"
        />
        <StatCard
          title={t('todayCreditSales', "Today's Credit Sales")}
          value={formatINR(summary.todayCreditSalesRupees || 0)}
          subtitle={`${t('thisMonth', 'This Month')}: ${formatINR(summary.monthCreditSalesRupees || 0)}`}
          icon={TrendingUp}
          variant="indigo"
        />
        <StatCard
          title={t('activeCustomersCount', 'Active Customers')}
          value={String(summary.customerCount || 0)}
          subtitle={
            isGujarati
              ? `${summary.customersWithBaaki || 0} બાકી ખાતા | ${summary.fullySettledCustomers || 0} ચુકતે ખાતા`
              : `${summary.customersWithBaaki || 0} With Balance Due | ${summary.fullySettledCustomers || 0} Settled`
          }
          icon={Users}
          variant="slate"
        />
      </div>

      {/* Middle Grid: Aging Chart & Top Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Analysis Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t('agingAnalysisTitle', 'Credit Aging Analysis (Overdue Balances)')}</h3>
              <p className="text-xs text-slate-500">{isGujarati ? 'સમય મર્યાદા અનુસાર બાકી બિલ રકમ' : 'Unpaid balance by age bracket'}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-0.5"
            >
              <span>{isGujarati ? 'સંપૂર્ણ અહેવાલ' : 'Full Report'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatINR(value), t('balanceDue', 'Outstanding Balance')]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Debtors List */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('highestBalancesTitle', 'Highest Outstanding Balances')}</h3>
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {t('viewAll', 'View All')}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {summary.topDebtors && summary.topDebtors.length > 0 ? (
                summary.topDebtors.map((debtor) => (
                  <div
                    key={debtor.customerId}
                    onClick={() => navigate(`/customers/${debtor.customerId}/ledger`)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">{debtor.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{debtor.customerCode}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-600 block">{formatINR(debtor.baakiRupees || 0)}</span>
                      <span className="text-[10px] text-slate-400">{t('balanceDue', 'Balance Due')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t('noDebtorsFound', 'No outstanding balances. All accounts are settled!')}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">{t('openingBalance', 'Opening Balance')}:</span>
              <span className="font-semibold text-slate-800">{formatINR(summary.totalOpeningBalanceRupees || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Invoices & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Credit Invoices */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{t('recentInvoices', 'Recent Credit Invoices')}</h3>
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {t('viewAll', 'View All')}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {recentInvoices.map((inv) => (
              <div
                key={inv._id}
                onClick={() => navigate(`/invoices`)}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                    <Badge variant={inv.status === 'POSTED' ? (inv.isFullyPaid ? 'emerald' : 'amber') : 'rose'}>
                      {inv.status === 'POSTED' ? (inv.isFullyPaid ? (isGujarati ? 'ચુકતે' : 'Paid') : (isGujarati ? 'બાકી' : 'Unpaid')) : (isGujarati ? 'રદ' : 'Reversed')}
                    </Badge>
                  </div>
                  <span className="text-slate-500 block mt-0.5">
                    {typeof inv.customerId === 'object' ? inv.customerId?.name : 'Customer'} • {formatDate(inv.transactionDate)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 text-sm block">{formatINR(inv.totalAmountRupees)}</span>
                  {inv.remainingBalanceRupees !== undefined && inv.remainingBalanceRupees > 0 && (
                    <span className="text-[11px] text-rose-600 block">{t('balanceDue', 'Due')}: {formatINR(inv.remainingBalanceRupees)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments Received */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{t('recentPayments', 'Recent Collections')}</h3>
            <button
              type="button"
              onClick={() => navigate('/payments')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {t('viewAll', 'View All')}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {recentPayments.map((p) => (
              <div
                key={p._id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">{p.receiptNumber}</span>
                    <Badge variant="blue">{p.paymentMethod}</Badge>
                  </div>
                  <span className="text-slate-500 block mt-0.5">
                    {typeof p.customerId === 'object' ? p.customerId?.name : 'Customer'} • {formatDate(p.paymentDate)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-600 text-sm block">+{formatINR(p.amountRupees)}</span>
                  <span className="text-[11px] text-slate-400 block">
                    {p.allocations?.length ? `${isGujarati ? 'ફાળવેલ' : 'Allocated'} (${p.allocations.length})` : (isGujarati ? 'બિન-ફાળવેલ' : 'Unallocated')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
