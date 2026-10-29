import api from './api';
import { PaymentRecord } from '../types';

function mapPayment(raw: any): PaymentRecord {
  const amt = parseFloat(raw.amount ?? raw.amountRupees ?? 0);
  const allocs = (raw.allocations || []).map((a: any) => ({
    _id: String(a.id ?? a._id ?? Math.random()),
    invoiceId: String(a.invoice_id ?? a.invoiceId ?? ''),
    allocatedAmount: Math.round(parseFloat(a.allocated_amount ?? a.allocatedAmount ?? 0) * 100),
    allocatedAmountRupees: parseFloat(a.allocated_amount ?? a.allocatedAmount ?? 0),
    allocationDate: a.created_at ?? new Date().toISOString(),
    status: 'ACTIVE' as const,
  }));

  const calculatedAllocated = allocs.reduce((sum: number, a: any) => sum + a.allocatedAmountRupees, 0);
  const totalAllocated = raw.allocated_amount !== undefined
    ? parseFloat(raw.allocated_amount)
    : calculatedAllocated;
  const unallocated = raw.unallocated_amount !== undefined
    ? parseFloat(raw.unallocated_amount)
    : Math.max(0, amt - totalAllocated);

  const mode = String(raw.mode || raw.paymentMethod || 'CASH').toUpperCase();
  const validMode = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'].includes(mode)
    ? (mode as any)
    : 'OTHER';

  const custObj = typeof raw.customer === 'object' && raw.customer !== null ? {
    _id: String(raw.customer.id ?? raw.customer._id),
    name: raw.customer.name,
    customerCode: raw.customer.code ?? `CUST-${raw.customer.id}`,
    mobile: raw.customer.phone ?? '',
  } : {
    _id: String(raw.customer_id ?? (typeof raw.customerId === 'object' ? raw.customerId?._id : raw.customerId) ?? ''),
    name: raw.customer_name || (typeof raw.customerId === 'object' ? raw.customerId?.name : 'Customer'),
    customerCode: raw.customer_code || `CUST-${raw.customer_id || ''}`,
    mobile: raw.customer_phone || '',
  };

  return {
    _id: String(raw.id ?? raw._id),
    receiptNumber: raw.receipt_number ?? raw.receiptNumber ?? `RCP-${raw.id || '0000'}`,
    customerId: custObj,
    paymentDate: raw.payment_date ?? raw.paymentDate ?? new Date().toISOString().split('T')[0],
    amount: Math.round(amt * 100),
    amountRupees: amt,
    allocatedAmountRupees: totalAllocated,
    unallocatedAmountRupees: unallocated,
    paymentMethod: validMode,
    referenceNumber: raw.reference ?? raw.referenceNumber ?? '',
    notes: raw.notes ?? '',
    allocations: allocs,
    status: 'POSTED',
    createdBy: { _id: '1', name: 'Staff', username: 'staff' },
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export const paymentService = {
  async getPayments(params?: {
    customerId?: string;
    status?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: PaymentRecord[]; total: number }> {
    const res = await api.get('/payments', {
      params: {
        customer_id: params?.customerId ? parseInt(params.customerId, 10) : undefined,
        q: params?.search ? params.search.trim() : undefined,
        date_from: params?.startDate,
        date_to: params?.endDate,
      },
    });
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const mapped = list.map(mapPayment);
    return { data: mapped, total: mapped.length };
  },

  async getPaymentById(id: string): Promise<PaymentRecord> {
    const res = await api.get(`/payments/${id}`);
    const raw = res.data?.data || res.data;
    return mapPayment(raw);
  },

  async createPayment(data: {
    customerId: string;
    paymentDate?: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    allocations?: Array<{
      invoiceId: string;
      allocatedAmount: number;
    }>;
  }): Promise<{ data: PaymentRecord; customerSummary: any }> {
    const body = {
      customer_id: parseInt(data.customerId, 10),
      payment_date: data.paymentDate || new Date().toISOString().split('T')[0],
      amount: data.amount,
      mode: (data.paymentMethod || 'cash').toLowerCase(),
      reference: data.referenceNumber || undefined,
      notes: data.notes || undefined,
      allocations: (data.allocations || []).map(a => ({
        invoice_id: parseInt(a.invoiceId, 10),
        allocated_amount: a.allocatedAmount,
      })),
    };
    const res = await api.post('/payments', body);
    const raw = res.data?.data || res.data;
    const mapped = mapPayment(raw);
    return { data: mapped, customerSummary: {} };
  },

  async deletePayment(id: string): Promise<void> {
    await api.delete(`/payments/${id}`);
  },

  async reversePayment(id: string, reason?: string): Promise<void> {
    await api.delete(`/payments/${id}`);
  },
};
