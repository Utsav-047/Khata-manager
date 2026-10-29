import api from './api';
import { Customer, LedgerEntry } from '../types';

function mapCustomer(raw: any): Customer {
  const bal = parseFloat(raw.current_balance ?? raw.outstandingBalanceRupees ?? 0);
  const ob = parseFloat(raw.opening_balance ?? raw.openingBalanceRupees ?? 0);
  const debits = parseFloat(raw.total_debits ?? raw.totalDebitsRupees ?? 0);
  const credits = parseFloat(raw.total_credits ?? raw.totalPaymentsRupees ?? 0);

  return {
    _id: String(raw.id ?? raw._id),
    customerCode: raw.code ?? raw.customerCode ?? `CUST-${raw.id || '0000'}`,
    name: raw.name || '',
    mobile: raw.phone ?? raw.mobile ?? '',
    email: raw.email ?? '',
    address: raw.address ?? '',
    notes: raw.notes ?? '',
    openingBalance: Math.round(ob * 100),
    openingBalanceRupees: ob,
    openingBalanceDate: raw.created_at ?? raw.openingBalanceDate,
    outstandingBalance: Math.round(bal * 100),
    outstandingBalanceRupees: bal,
    totalDebitsRupees: debits,
    totalPaymentsRupees: credits,
    isSettled: bal <= 0,
    isActive: raw.is_active ?? raw.isActive ?? true,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export const customerService = {
  async getCustomers(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Customer[]; total: number }> {
    const res = await api.get('/customers', {
      params: {
        q: params?.search ? params.search.trim() : undefined,
        active_only: params?.status === 'inactive' ? false : (params?.status === 'all' ? false : true),
      },
    });
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const mapped = list.map(mapCustomer);
    return { data: mapped, total: mapped.length };
  },

  async getCustomerById(id: string): Promise<Customer & { balanceSummary: any }> {
    const res = await api.get(`/customers/${id}`);
    const raw = res.data?.data || res.data;
    const c = mapCustomer(raw);
    return {
      ...c,
      balanceSummary: {
        currentBalance: c.outstandingBalanceRupees,
        openingBalance: c.openingBalanceRupees,
        totalDebits: c.totalDebitsRupees || 0,
        totalCredits: c.totalPaymentsRupees || 0,
      },
    };
  },

  async createCustomer(data: {
    name: string;
    customerCode?: string;
    mobile?: string;
    email?: string;
    address?: string;
    notes?: string;
    openingBalance?: number;
    openingBalanceDate?: string;
  }): Promise<Customer> {
    const body = {
      name: data.name,
      phone: data.mobile || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      notes: data.notes || undefined,
      opening_balance: data.openingBalance || 0,
    };
    const res = await api.post('/customers', body);
    const raw = res.data?.data || res.data;
    return mapCustomer(raw);
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.mobile !== undefined) body.phone = data.mobile;
    if (data.email !== undefined) body.email = data.email;
    if (data.address !== undefined) body.address = data.address;
    if (data.notes !== undefined) body.notes = data.notes;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    const res = await api.patch(`/customers/${id}`, body);
    const raw = res.data?.data || res.data;
    return mapCustomer(raw);
  },

  async toggleCustomerStatus(id: string): Promise<Customer> {
    const res = await api.patch(`/customers/${id}/toggle-status`);
    const raw = res.data?.data || res.data;
    return mapCustomer(raw);
  },

  async getCustomerLedger(
    id: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<{
    customer: Customer;
    summary: any;
    ledger: LedgerEntry[];
  }> {
    const res = await api.get(`/customers/${id}/ledger`, {
      params: {
        date_from: params?.startDate || undefined,
        date_to: params?.endDate || undefined,
      },
    });
    const raw = res.data?.data || res.data;
    const custRaw = raw.customer || {};

    const entries: LedgerEntry[] = (raw.entries || []).map((e: any, index: number) => {
      const debitVal = parseFloat(e.debit || 0);
      const creditVal = parseFloat(e.credit || 0);
      const balVal = parseFloat(e.balance || 0);
      const isDebit = debitVal > 0;

      return {
        srNo: index + 1,
        date: e.date,
        refNumber: e.reference || '',
        refId: String(e.id || ''),
        entityType: e.type === 'invoice' ? 'Transaction' : e.type === 'payment' ? 'Payment' : 'OpeningBalance',
        description: e.description || e.type,
        type: e.type === 'opening' ? 'OPENING' : isDebit ? 'DEBIT' : 'CREDIT',
        debit: Math.round(debitVal * 100),
        credit: Math.round(creditVal * 100),
        runningBalance: Math.round(balVal * 100),
        debitRupees: debitVal,
        creditRupees: creditVal,
        runningBalanceRupees: balVal,
        status: 'POSTED',
        createdBy: 'Staff',
      };
    });

    const cust: Customer = {
      _id: String(custRaw.id || id),
      customerCode: custRaw.code || `CUST-${id}`,
      name: custRaw.name || raw.customer_name || 'Customer',
      mobile: custRaw.phone || '',
      address: custRaw.address || '',
      openingBalance: Math.round(parseFloat(raw.opening_balance ?? custRaw.opening_balance ?? 0) * 100),
      openingBalanceRupees: parseFloat(raw.opening_balance ?? custRaw.opening_balance ?? 0),
      outstandingBalance: Math.round(parseFloat(raw.closing_balance ?? raw.current_balance ?? 0) * 100),
      outstandingBalanceRupees: parseFloat(raw.closing_balance ?? raw.current_balance ?? 0),
      totalDebitsRupees: parseFloat(raw.total_debit ?? raw.total_debits ?? 0),
      totalPaymentsRupees: parseFloat(raw.total_credit ?? raw.total_credits ?? 0),
      isActive: custRaw.is_active ?? true,
      createdAt: custRaw.created_at || new Date().toISOString(),
    };

    return {
      customer: cust,
      summary: {
        openingBalance: cust.openingBalanceRupees,
        closingBalance: cust.outstandingBalanceRupees,
        currentBalance: cust.outstandingBalanceRupees,
        totalDebits: cust.totalDebitsRupees,
        totalCredits: cust.totalPaymentsRupees,
      },
      ledger: entries,
    };
  },
};
