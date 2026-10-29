import api from './api';
import { DashboardSummary } from '../types';

export const reportService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const [dashRes, agingRes] = await Promise.all([
      api.get('/reports/dashboard').catch(() => ({ data: {} })),
      api.get('/reports/aging').catch(() => ({ data: [] })),
    ]);

    const raw = dashRes.data?.data || dashRes.data || {};
    const agingBuckets = Array.isArray(agingRes.data) ? agingRes.data : (agingRes.data?.data || []);

    const totReceivable = parseFloat(raw.total_receivable ?? raw.totalOutstandingBaakiRupees ?? 0);
    const openingBal = parseFloat(raw.total_opening_balance ?? 0);
    const todaySales = parseFloat(raw.today_sales ?? 0);
    const monthSales = parseFloat(raw.month_sales ?? 0);
    const todayPayments = parseFloat(raw.today_collected ?? 0);
    const monthPayments = parseFloat(raw.month_collected ?? raw.total_collected_month ?? 0);
    const overdue = parseFloat(raw.overdue_amount ?? 0);

    const d0_30 = agingBuckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_1_30 || 0) + parseFloat(b.current || 0), 0);
    const d31_60 = agingBuckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_31_60 || 0), 0);
    const d61_90 = agingBuckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_61_90 || 0), 0);
    const d90plus = agingBuckets.reduce((sum: number, b: any) => sum + parseFloat(b.over_90 || 0), 0);

    const topDebtors = (raw.top_customers || raw.topDebtors || []).map((tc: any) => ({
      customerId: String(tc.id ?? tc.customerId ?? ''),
      customerCode: tc.code ?? tc.customerCode ?? `CUST-${tc.id || ''}`,
      name: tc.name,
      mobile: tc.phone ?? tc.mobile ?? '',
      outstandingBalanceRupees: parseFloat(tc.balance ?? tc.baakiRupees ?? 0),
      baakiRupees: parseFloat(tc.balance ?? tc.baakiRupees ?? 0),
    }));

    const activeCust = raw.active_customers ?? raw.total_customers ?? raw.customerCount ?? 0;
    const dueCust = raw.customers_with_balance_due ?? raw.customersWithBaaki ?? 0;
    const settledCust = raw.fully_settled_customers ?? Math.max(0, activeCust - dueCust);

    return {
      totalOutstandingBalanceRupees: totReceivable,
      totalOutstandingBaakiRupees: totReceivable,
      totalOpeningBalanceRupees: openingBal,
      todayCreditSalesRupees: todaySales,
      monthCreditSalesRupees: monthSales,
      todayPaymentsRupees: todayPayments,
      monthPaymentsRupees: monthPayments,
      customerCount: activeCust,
      customersWithBalanceDue: dueCust,
      customersWithBaaki: dueCust,
      fullySettledCustomers: settledCust,
      topDebtors,
      aging: {
        days0To30Rupees: d0_30,
        days31To60Rupees: d31_60,
        days61To90Rupees: d61_90,
        daysOver90Rupees: d90plus || overdue,
        totalUnpaidInvoicesRupees: totReceivable,
      },
    };
  },

  async getOutstandingReport(status?: string) {
    const res = await api.get('/reports/outstanding', { params: { status } });
    const data = res.data?.data || res.data;

    if (data && typeof data === 'object' && Array.isArray(data.rows)) {
      return {
        rows: data.rows.map((r: any) => ({
          customerId: String(r.customerId || r.customer_id || ''),
          customerCode: r.customerCode || `CUST-${r.customerId || r.customer_id || ''}`,
          name: r.name || r.customer_name || '',
          mobile: r.mobile || r.phone || '',
          openingBalanceRupees: parseFloat(r.openingBalanceRupees || r.opening_balance || 0),
          totalDebitsRupees: parseFloat(r.totalDebitsRupees || r.total_invoiced || 0),
          totalPaymentsRupees: parseFloat(r.totalPaymentsRupees || r.total_paid || 0),
          outstandingBalanceRupees: parseFloat(r.outstandingBalanceRupees || r.balance_due || 0),
          isSettled: r.isSettled ?? ((r.outstandingBalanceRupees || r.balance_due || 0) <= 0),
        })),
        totalCustomers: data.totalCustomers || data.rows.length,
        totalOutstandingRupees: parseFloat(data.totalOutstandingRupees || 0),
      };
    }

    const list = Array.isArray(data) ? data : [];
    const mapped = list.map((r: any) => ({
      customerId: String(r.customer_id ?? r.customerId ?? ''),
      customerCode: r.customer_code ?? `CUST-${r.customer_id || ''}`,
      name: r.customer_name || r.name || '',
      mobile: r.phone || r.mobile || '',
      openingBalanceRupees: parseFloat(r.opening_balance || 0),
      totalDebitsRupees: parseFloat(r.total_invoiced || 0),
      totalPaymentsRupees: parseFloat(r.total_paid || 0),
      outstandingBalanceRupees: parseFloat(r.balance_due || r.outstandingBalanceRupees || 0),
      isSettled: (r.balance_due || r.outstandingBalanceRupees || 0) <= 0,
    }));
    const totalOut = mapped.reduce((sum: number, r: any) => sum + Math.max(0, r.outstandingBalanceRupees), 0);
    return {
      rows: mapped,
      totalCustomers: mapped.length,
      totalOutstandingRupees: totalOut,
    };
  },

  async getCollectionsReport(params?: { startDate?: string; endDate?: string; paymentMethod?: string }) {
    const today = new Date().toISOString().split('T')[0];
    const res = await api.get('/reports/collections', {
      params: {
        date_from: params?.startDate || undefined,
        date_to: params?.endDate || today,
        method: params?.paymentMethod && params.paymentMethod !== 'ALL' ? params.paymentMethod : undefined,
      },
    });
    const data = res.data?.data || res.data;

    if (data && typeof data === 'object' && Array.isArray(data.rows)) {
      return data;
    }

    return {
      rows: [],
      breakdownByMethod: {
        cashRupees: 0,
        upiRupees: 0,
        bankTransferRupees: 0,
        chequeRupees: 0,
        otherRupees: 0,
      },
      totalCollectedRupees: 0,
      count: 0,
    };
  },

  async getUnallocatedReport() {
    const res = await api.get('/reports/unallocated').catch(() => ({ data: { rows: [], count: 0, totalUnallocatedRupees: 0 } }));
    const data = res.data?.data || res.data;
    if (data && typeof data === 'object' && Array.isArray(data.rows)) {
      return data;
    }
    return {
      rows: [],
      count: 0,
      totalUnallocatedRupees: 0,
    };
  },

  async getAgingReport() {
    const res = await api.get('/reports/aging');
    const buckets = Array.isArray(res.data) ? res.data : (res.data?.data || []);

    const d0_30 = buckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_1_30 || 0) + parseFloat(b.current || 0), 0);
    const d31_60 = buckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_31_60 || 0), 0);
    const d61_90 = buckets.reduce((sum: number, b: any) => sum + parseFloat(b.days_61_90 || 0), 0);
    const d90plus = buckets.reduce((sum: number, b: any) => sum + parseFloat(b.over_90 || 0), 0);

    return {
      days0To30Rupees: d0_30,
      days31To60Rupees: d31_60,
      days61To90Rupees: d61_90,
      daysOver90Rupees: d90plus,
      buckets,
    };
  },
};
