export interface User {
  id: string;
  _id?: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'staff';
  permissions: string[];
  isActive?: boolean;
  lastLoginAt?: string;
}

export interface Customer {
  _id: string;
  customerCode: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  notes?: string;
  openingBalance: number; // in paise
  openingBalanceRupees: number;
  openingBalanceDate?: string;
  outstandingBalance: number;
  outstandingBalanceRupees: number;
  totalDebitsRupees?: number;
  totalPaymentsRupees?: number;
  isSettled?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  _id: string;
  productCode: string;
  name: string;
  unit: string;
  defaultPrice: number; // in paise
  defaultPriceRupees: number;
  currentStock: number;
  minStockAlert?: number;
  description?: string;
  isActive: boolean;
}

export interface InvoiceItem {
  _id?: string;
  productId: string;
  productNameSnapshot: string;
  productCodeSnapshot?: string;
  unitSnapshot: string;
  quantity: number;
  unitPrice: number; // in paise
  unitPriceRupees: number;
  lineTotal: number; // in paise
  lineTotalRupees: number;
}

export interface TransactionInvoice {
  _id: string;
  invoiceNumber: string;
  customerId: Customer | { _id: string; name: string; customerCode: string; mobile: string; address?: string };
  transactionDate: string;
  items: InvoiceItem[];
  subtotal: number;
  subtotalRupees: number;
  discount: number;
  discountRupees: number;
  additionalCharges: number;
  additionalChargesRupees: number;
  totalAmount: number;
  totalAmountRupees: number;
  remainingBalanceRupees?: number;
  allocatedAmountRupees?: number;
  isFullyPaid?: boolean;
  isPartiallyPaid?: boolean;
  notes?: string;
  status: 'POSTED' | 'REVERSED';
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: { name: string; username: string };
  createdBy: { _id: string; name: string; username: string };
  createdAt: string;
  allocations?: Array<{
    paymentId: string;
    receiptNumber: string;
    paymentDate: string;
    paymentMethod: string;
    allocatedAmountRupees: number;
  }>;
}

export interface PaymentAllocation {
  _id?: string;
  invoiceId: string | { _id: string; invoiceNumber: string; totalAmount: number };
  allocatedAmount: number; // in paise
  allocatedAmountRupees?: number;
  allocationDate?: string;
  status?: 'ACTIVE' | 'REVERSED';
}

export interface PaymentRecord {
  _id: string;
  receiptNumber: string;
  customerId: Customer | { _id: string; name: string; customerCode: string; mobile: string };
  paymentDate: string;
  amount: number; // in paise
  amountRupees: number;
  allocatedAmountRupees: number;
  unallocatedAmountRupees: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  referenceNumber?: string;
  notes?: string;
  allocations: PaymentAllocation[];
  status: 'POSTED' | 'REVERSED';
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: { name: string; username: string };
  createdBy: { _id: string; name: string; username: string };
  createdAt: string;
}

export interface LedgerEntry {
  srNo: number;
  date: string;
  refNumber: string;
  refId: string;
  entityType: 'Transaction' | 'Payment' | 'OpeningBalance';
  description: string;
  type: 'DEBIT' | 'CREDIT' | 'OPENING';
  debit: number;
  credit: number;
  runningBalance: number;
  debitRupees: number;
  creditRupees: number;
  runningBalanceRupees: number;
  status: 'POSTED' | 'REVERSED';
  reversalReason?: string;
  createdBy: string;
}

export interface DashboardSummary {
  totalOutstandingBalanceRupees?: number;
  totalOutstandingBaakiRupees: number;
  totalOpeningBalanceRupees: number;
  todayCreditSalesRupees: number;
  monthCreditSalesRupees: number;
  todayPaymentsRupees: number;
  monthPaymentsRupees: number;
  customerCount: number;
  customersWithBalanceDue?: number;
  customersWithBaaki: number;
  fullySettledCustomers: number;
  topDebtors: Array<{
    customerId: string;
    customerCode: string;
    name: string;
    mobile: string;
    outstandingBalanceRupees?: number;
    baakiRupees: number;
  }>;
  aging: {
    days0To30Rupees: number;
    days31To60Rupees: number;
    days61To90Rupees: number;
    daysOver90Rupees: number;
    totalUnpaidInvoicesRupees: number;
  };
}

export interface BusinessSetting {
  _id?: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  currencySymbol: string;
  allowAdvancePayments: boolean;
  defaultCreditPeriodDays: number;
  invoiceNote: string;
}
