import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { transactionService } from '../../services/transactionService';
import { Customer, Product, TransactionInvoice } from '../../types';
import { InvoicePrintModal } from '../../components/InvoicePrintModal';
import { formatINR } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';

interface LineItemForm {
  productId: string;
  productName: string;
  quantity: number | '';
  unitPrice: number | '';
  lineTotal: number;
  unit: string;
}

export const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';
  const { t, isGujarati } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItemForm[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0, lineTotal: 0, unit: 'pcs' },
  ]);
  const [discount, setDiscount] = useState<number | ''>('');
  const [additionalCharges, setAdditionalCharges] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedInvoice, setSavedInvoice] = useState<TransactionInvoice | null>(null);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          customerService.getCustomers({ limit: 200 }),
          productService.getProducts({ limit: 200 }),
        ]);
        setCustomers(cRes.data || []);
        setProducts(pRes.data || []);

        if (preselectedCustomerId && cRes.data) {
          const match = cRes.data.find((c: Customer) => c._id === preselectedCustomerId);
          if (match) {
            setSelectedCustomerId(match._id);
            setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.error('Failed to load customers/products:', err);
      }
    };
    loadMasters();
  }, [preselectedCustomerId]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const found = customers.find((c) => c._id === customerId) || null;
    setSelectedCustomer(found);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p._id === productId);
    const updated = [...items];
    const unitPrice = prod ? prod.defaultPriceRupees : 0;
    const unit = prod ? prod.unit : 'pcs';
    const quantity = updated[index].quantity || 1;
    const lineTotal = Number((quantity * unitPrice).toFixed(2));

    updated[index] = {
      ...updated[index],
      productId,
      productName: prod ? prod.name : '',
      unitPrice,
      unit,
      lineTotal,
    };
    setItems(updated);
  };

  const handleQuantityChange = (index: number, valStr: string) => {
    const updated = [...items];
    if (valStr === '') {
      updated[index] = { ...updated[index], quantity: '', lineTotal: 0 };
    } else {
      const qty = parseFloat(valStr);
      const price = typeof updated[index].unitPrice === 'number'
        ? updated[index].unitPrice
        : (parseFloat(updated[index].unitPrice as string) || 0);
      const validQty = isNaN(qty) ? 0 : qty;
      const lineTotal = Number((validQty * price).toFixed(2));
      updated[index] = { ...updated[index], quantity: isNaN(qty) ? '' : qty, lineTotal };
    }
    setItems(updated);
  };

  const handlePriceChange = (index: number, valStr: string) => {
    const updated = [...items];
    if (valStr === '') {
      updated[index] = { ...updated[index], unitPrice: '', lineTotal: 0 };
    } else {
      const price = parseFloat(valStr);
      const qty = typeof updated[index].quantity === 'number'
        ? updated[index].quantity
        : (parseFloat(updated[index].quantity as string) || 0);
      const validPrice = isNaN(price) ? 0 : price;
      const lineTotal = Number((qty * validPrice).toFixed(2));
      updated[index] = { ...updated[index], unitPrice: isNaN(price) ? '' : price, lineTotal };
    }
    setItems(updated);
  };

  const addLineItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, lineTotal: 0, unit: 'pcs' }]);
  };

  const removeLineItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Standard Invoice Calculation Formula: Total = Subtotal - Discount + Additional Charges / Tax
  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const discountNum = typeof discount === 'number' ? discount : (parseFloat(discount) || 0);
  const chargesNum = typeof additionalCharges === 'number' ? additionalCharges : (parseFloat(additionalCharges) || 0);
  const totalInvoiceAmount = Math.max(0, Number((subtotal - discountNum + chargesNum).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError(isGujarati ? 'કૃપા કરીને ગ્રાહક ખાતું પસંદ કરો.' : 'Please select a customer for this credit transaction.');
      return;
    }

    const invalidItems = items.some((i) => {
      const q = typeof i.quantity === 'number' ? i.quantity : (parseFloat(i.quantity) || 0);
      return !i.productId || q <= 0;
    });
    if (invalidItems) {
      setError(isGujarati ? 'કૃપા કરીને દરેક લાઇન માટે માન્ય ઉત્પાદન અને જથ્થો દાખલ કરો.' : 'Please select a valid product and quantity for each line item.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const created = await transactionService.createTransaction({
        customerId: selectedCustomerId,
        transactionDate,
        dueDate: dueDate || undefined,
        items: items.map((i) => {
          const prod = products.find((p) => p._id === i.productId);
          const q = typeof i.quantity === 'number' ? i.quantity : (parseFloat(i.quantity) || 0);
          const p = typeof i.unitPrice === 'number' ? i.unitPrice : (parseFloat(i.unitPrice) || 0);
          return {
            productId: i.productId,
            productName: prod?.name || i.productName || 'Item',
            unit: prod?.unit || i.unit || 'pcs',
            quantity: q,
            unitPrice: p,
          };
        }),
        discount: discountNum,
        additionalCharges: chargesNum,
        notes,
      });

      setSavedInvoice(created);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || (isGujarati ? 'બિલ બનાવવામાં ભૂલ આવી' : 'Failed to create invoice');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('createInvoiceTitle', 'Create Credit Invoice')}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Date Selection Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            {isGujarati ? '૧. ગ્રાહક અને બિલ તારીખની વિગત' : '1. Customer Account & Billing Date'}
          </h3>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('customerFullName', 'Customer Account')} *
              </label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
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
                {t('invoiceDate', 'Invoice Date')} *
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('dueDate', 'Due Date')} ({isGujarati ? 'વૈકલ્પિક' : 'Optional'})
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Current Customer Balance Information Strip */}
          {selectedCustomer && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between text-xs gap-2">
              <div>
                <span className="text-slate-500">{t('customerFullName', 'Customer')}:</span>{' '}
                <strong className="text-slate-800">{selectedCustomer.name}</strong>{' '}
                <span className="text-slate-400 font-mono">({selectedCustomer.customerCode})</span>
              </div>
              <div>
                <span className="text-slate-500">{t('balanceDue', 'Current Balance')}:</span>{' '}
                <strong
                  className={selectedCustomer.outstandingBalanceRupees > 0 ? 'text-rose-600' : 'text-emerald-600'}
                >
                  {formatINR(selectedCustomer.outstandingBalanceRupees)}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Multi-Product Line Items Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {isGujarati ? '૨. માલ સામાન અને જથ્થો (લાઇન આઇટમ)' : '2. Products & Quantities (Line Items)'}
            </h3>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addItem', 'Add Line Item')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center gap-3"
              >
                <div className="w-full md:flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-500">{t('product', 'Product')} *</label>
                    {(() => {
                      const selProd = products.find((p) => p._id === item.productId);
                      if (!selProd) return null;
                      const isLow = selProd.currentStock <= (selProd.minStockAlert ?? 10);
                      const isZero = selProd.currentStock <= 0;
                      return (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isZero
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          Stock: {selProd.currentStock.toLocaleString()} {selProd.unit}
                        </span>
                      );
                    })()}
                  </div>
                  <select
                    required
                    value={item.productId}
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 bg-white text-slate-900"
                  >
                    <option value="">{isGujarati ? '-- ઉત્પાદન પસંદ કરો --' : '-- Select Product --'}</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.unit} - Stock: {p.currentStock.toLocaleString()} | Rate: ₹{p.defaultPriceRupees})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full md:w-28">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {t('quantity', 'Qty')} ({item.unit || 'Unit'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={item.quantity}
                    placeholder="1"
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 text-slate-900 font-semibold"
                  />
                  {(() => {
                    const selProd = products.find((p) => p._id === item.productId);
                    const qtyNum = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity) || 0);
                    if (selProd && qtyNum > selProd.currentStock) {
                      return (
                        <span className="text-[10px] text-rose-600 block mt-0.5 font-medium">
                          Exceeds stock ({selProd.currentStock})
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="w-full md:w-32">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">{t('unitPrice', 'Rate (₹)')} *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={item.unitPrice}
                    placeholder="0.00"
                    onChange={(e) => handlePriceChange(index, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 text-slate-900"
                  />
                </div>

                <div className="w-full md:w-36 text-right">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">{t('lineTotal', 'Line Total')}</label>
                  <div className="text-sm font-extrabold text-slate-900 py-1 font-mono">
                    {formatINR(item.lineTotal)}
                  </div>
                </div>

                <div className="self-end md:self-center pt-2 md:pt-4">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={items.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals & Notes Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('customerRemarks', 'Remarks / Payment Terms')}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isGujarati ? 'દા.ત. પાક લણણી સમયે ચુકવણી આપવાની શરત' : 'e.g. Payment promised on harvest or via UPI'}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">{t('subtotal', 'Items Subtotal')}:</span>
                <span className="font-semibold text-slate-800 text-sm">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">{t('discount', 'Discount (₹)')}:</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={discount}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscount(val === '' ? '' : parseFloat(val));
                  }}
                  className="w-28 text-right px-2 py-1 text-xs border border-slate-200 rounded text-slate-900 font-semibold"
                />
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">{t('additionalCharges', 'Additional Charges / Tax (₹)')}:</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={additionalCharges}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = e.target.value;
                    setAdditionalCharges(val === '' ? '' : parseFloat(val));
                  }}
                  className="w-28 text-right px-2 py-1 text-xs border border-slate-200 rounded text-slate-900 font-semibold"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">{t('invoiceTotal', 'Final Invoice Total')}:</span>
                <span className="text-xl font-extrabold text-emerald-600">{formatINR(totalInvoiceAmount)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? t('saving', 'Posting Invoice...') : t('generateInvoice', 'Generate Credit Invoice')}
            </button>
          </div>
        </div>
      </form>

      {/* Invoice Generated Success Modal */}
      <InvoicePrintModal
        isOpen={!!savedInvoice}
        onClose={() => {
          setSavedInvoice(null);
          navigate(`/customers/${selectedCustomerId}/ledger`);
        }}
        invoice={savedInvoice}
      />
    </div>
  );
};
