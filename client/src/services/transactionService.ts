import api from './api';
import { TransactionInvoice } from '../types';

function mapInvoice(raw: any): TransactionInvoice {
  const subtotal = parseFloat(raw.subtotal ?? 0);
  const discount = parseFloat(raw.discount_amount ?? raw.discountRupees ?? 0);
  const tax = parseFloat(raw.tax_amount ?? raw.additionalChargesRupees ?? 0);
  const total = parseFloat(raw.total_amount ?? raw.totalAmountRupees ?? 0);
  const paid = parseFloat(raw.amount_paid ?? raw.allocatedAmountRupees ?? 0);
  const bal = parseFloat(raw.balance_due ?? raw.remainingBalanceRupees ?? Math.max(0, total - paid));

  const items = (raw.items || []).map((it: any) => {
    const qty = parseFloat(it.quantity ?? 1);
    const unitPrice = parseFloat(it.unit_price ?? it.unitPriceRupees ?? 0);
    const lineTotal = parseFloat(it.line_total ?? it.lineTotalRupees ?? (qty * unitPrice));
    const prodName = it.product_name || it.productNameSnapshot || it.description || (it.product_id ? `Item #${it.product_id}` : 'Item');
    const unitName = it.unit || it.unitSnapshot || 'pcs';

    return {
      _id: String(it.id ?? it._id ?? Math.random()),
      productId: String(it.product_id ?? it.productId ?? ''),
      productNameSnapshot: prodName,
      productCodeSnapshot: it.product_code || undefined,
      unitSnapshot: unitName,
      quantity: qty,
      unitPrice: Math.round(unitPrice * 100),
      unitPriceRupees: unitPrice,
      lineTotal: Math.round(lineTotal * 100),
      lineTotalRupees: lineTotal,
    };
  });

  const custObj = typeof raw.customer === 'object' && raw.customer !== null ? {
    _id: String(raw.customer.id ?? raw.customer._id),
    name: raw.customer.name,
    customerCode: raw.customer.code ?? `CUST-${raw.customer.id}`,
    mobile: raw.customer.phone ?? '',
    address: raw.customer.address ?? '',
  } : {
    _id: String(raw.customer_id ?? (typeof raw.customerId === 'object' ? raw.customerId?._id : raw.customerId) ?? ''),
    name: raw.customer_name || (typeof raw.customerId === 'object' ? raw.customerId?.name : 'Customer'),
    customerCode: raw.customer_code || `CUST-${raw.customer_id || ''}`,
    mobile: raw.customer_phone || '',
    address: raw.customer_address || '',
  };

  const isPaid = raw.status === 'paid' || bal <= 0;
  const isPartial = raw.status === 'partial' || (paid > 0 && bal > 0);

  return {
    _id: String(raw.id ?? raw._id),
    invoiceNumber: raw.invoice_number ?? raw.invoiceNumber ?? `INV-${raw.id || '0000'}`,
    customerId: custObj,
    transactionDate: raw.invoice_date ?? raw.transactionDate ?? new Date().toISOString().split('T')[0],
    items,
    subtotal: Math.round(subtotal * 100),
    subtotalRupees: subtotal,
    discount: Math.round(discount * 100),
    discountRupees: discount,
    additionalCharges: Math.round(tax * 100),
    additionalChargesRupees: tax,
    totalAmount: Math.round(total * 100),
    totalAmountRupees: total,
    remainingBalanceRupees: bal,
    allocatedAmountRupees: paid,
    isFullyPaid: isPaid,
    isPartiallyPaid: isPartial,
    notes: raw.notes ?? '',
    status: raw.status === 'cancelled' ? 'REVERSED' : 'POSTED',
    createdBy: { _id: '1', name: 'Staff', username: 'staff' },
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    allocations: Array.isArray(raw.allocations) ? raw.allocations : [],
  };
}

export const transactionService = {
  async getTransactions(params?: {
    customerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: TransactionInvoice[]; total: number }> {
    const res = await api.get('/invoices', {
      params: {
        customer_id: params?.customerId ? parseInt(params.customerId, 10) : undefined,
        status_filter: params?.status && params.status !== 'all' ? params.status : undefined,
        q: params?.search ? params.search.trim() : undefined,
        date_from: params?.startDate,
        date_to: params?.endDate,
      },
    });
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const mapped = list.map(mapInvoice);
    return { data: mapped, total: mapped.length };
  },

  async getTransactionById(id: string): Promise<TransactionInvoice> {
    const res = await api.get(`/invoices/${id}`);
    const raw = res.data?.data || res.data;
    return mapInvoice(raw);
  },

  async createTransaction(data: {
    customerId: string;
    transactionDate?: string;
    dueDate?: string;
    items: Array<{
      productId: string;
      productName?: string;
      unit?: string;
      quantity: number;
      unitPrice?: number;
    }>;
    discount?: number;
    additionalCharges?: number;
    notes?: string;
  }): Promise<TransactionInvoice> {
    const body = {
      customer_id: parseInt(data.customerId, 10),
      invoice_date: data.transactionDate || new Date().toISOString().split('T')[0],
      due_date: data.dueDate || undefined,
      discount_amount: data.discount || 0,
      additional_charges: data.additionalCharges || 0,
      notes: data.notes || undefined,
      items: data.items.map(it => ({
        product_id: parseInt(it.productId, 10) || null,
        description: it.productName || `Item #${it.productId}`,
        quantity: it.quantity,
        unit_price: it.unitPrice || 0,
        discount_pct: 0,
        tax_rate: 0,
      })),
    };
    const res = await api.post('/invoices', body);
    const raw = res.data?.data || res.data;
    return mapInvoice(raw);
  },

  async reverseTransaction(id: string, reason?: string): Promise<TransactionInvoice> {
    const res = await api.delete(`/invoices/${id}`);
    const raw = res.data?.data || res.data || { id, status: 'cancelled' };
    return mapInvoice(raw);
  },
};
