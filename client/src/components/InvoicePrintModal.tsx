import React from 'react';
import { Printer, Share2 } from 'lucide-react';
import { Modal } from './Modal';
import { TransactionInvoice, BusinessSetting } from '../types';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: TransactionInvoice | null;
  settings?: BusinessSetting | null;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice,
  settings,
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const customerName = typeof invoice.customerId === 'object' ? invoice.customerId?.name : 'Customer';
  const customerCode = typeof invoice.customerId === 'object' ? invoice.customerId?.customerCode : '';
  const customerMobile = typeof invoice.customerId === 'object' ? invoice.customerId?.mobile : '';
  const customerAddress = typeof invoice.customerId === 'object' ? invoice.customerId?.address : '';

  const handleShareWhatsApp = () => {
    const business = settings?.businessName || 'Kisan Krishi Seva Kendra';
    const msg = `🌾 *${business}*\n` +
      `--------------------------------\n` +
      `📄 *CREDIT INVOICE: ${invoice.invoiceNumber}*\n` +
      `📅 Date: ${formatDate(invoice.transactionDate)}\n` +
      `👤 Customer: ${customerName}${customerCode ? ` (${customerCode})` : ''}\n` +
      `--------------------------------\n` +
      `💰 *Invoice Total: ₹${invoice.totalAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` +
      (invoice.remainingBalanceRupees !== undefined ? `⚠️ *Remaining Balance Due: ₹${invoice.remainingBalanceRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` : '') +
      `--------------------------------\n` +
      `Thank you for your business!`;

    const cleanMobile = customerMobile ? customerMobile.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanMobile ? (cleanMobile.startsWith('91') && cleanMobile.length === 12 ? cleanMobile : (cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile)) : '';
    const url = `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Credit Invoice" maxWidth="2xl">
      <div className="flex justify-end space-x-2 mb-3 no-print">
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          title="Share invoice summary directly to customer on WhatsApp"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Invoice</span>
        </button>
      </div>

      <div id="printable-area" className="p-6 bg-white border border-slate-200 rounded-xl font-sans text-slate-800">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {settings?.businessName || 'Kisan Krishi Seva Kendra'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              {settings?.address || 'Main Mandi Road, Agricultural Trading Complex'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Phone: {settings?.phone || '+91 98765 43210'} {settings?.gstNumber ? `| GSTIN: ${settings.gstNumber}` : ''}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded">
              CREDIT INVOICE
            </span>
            <div className="mt-2 text-xs">
              <span className="text-slate-400 block font-medium">Invoice No:</span>
              <span className="text-base font-extrabold text-slate-900 font-mono">{invoice.invoiceNumber}</span>
              <span className="text-slate-400 block mt-1 font-medium">Date:</span>
              <span className="font-semibold text-slate-800">{formatDate(invoice.transactionDate)}</span>
            </div>
          </div>
        </div>

        {/* Billed To */}
        <div className="bg-slate-50 rounded-lg p-3 text-xs mb-5 border border-slate-100">
          <span className="text-slate-400 font-medium block uppercase tracking-wider text-[10px]">Customer Details</span>
          <div className="mt-1 flex justify-between items-start">
            <div>
              <span className="font-bold text-slate-900 text-sm">{customerName}</span>
              <span className="block text-slate-600 mt-0.5">Code: {customerCode} {customerMobile ? `| Mobile: ${customerMobile}` : ''}</span>
              {customerAddress && <span className="block text-slate-500 mt-0.5">Address: {customerAddress}</span>}
            </div>
            {invoice.status === 'REVERSED' && (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-bold rounded text-xs border border-rose-200">
                VOID / REVERSED
              </span>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden mb-5">
          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 text-left w-12">#</th>
              <th className="py-2.5 px-3 text-left">Product Description</th>
              <th className="py-2.5 px-3 text-right">Quantity</th>
              <th className="py-2.5 px-3 text-right">Unit Price</th>
              <th className="py-2.5 px-3 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 text-slate-500">{index + 1}</td>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  {item.productNameSnapshot}
                  {item.productCodeSnapshot && (
                    <span className="text-slate-400 font-normal ml-1">({item.productCodeSnapshot})</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                  {item.quantity} {item.unitSnapshot}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-700">
                  {formatINR(item.unitPriceRupees)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                  {formatINR(item.lineTotalRupees)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Summary */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Subtotal:</span>
              <span className="font-semibold text-slate-800">{formatINR(invoice.subtotalRupees)}</span>
            </div>
            {invoice.discountRupees > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600">
                <span>Discount:</span>
                <span>-{formatINR(invoice.discountRupees)}</span>
              </div>
            )}
            {invoice.additionalChargesRupees > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                <span>Additional Charges:</span>
                <span>+{formatINR(invoice.additionalChargesRupees)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-extrabold text-slate-900">
              <span>Invoice Total:</span>
              <span>{formatINR(invoice.totalAmountRupees)}</span>
            </div>
            {invoice.allocatedAmountRupees !== undefined && invoice.allocatedAmountRupees > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600">
                <span>Amount Paid:</span>
                <span>-{formatINR(invoice.allocatedAmountRupees)}</span>
              </div>
            )}
            {invoice.remainingBalanceRupees !== undefined && (
              <div className="flex justify-between py-1 text-xs">
                <span className="text-slate-500">Remaining Due:</span>
                <span className={`font-bold ${invoice.remainingBalanceRupees > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatINR(invoice.remainingBalanceRupees)}
                </span>
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <p className="text-xs text-slate-600 mb-5 bg-slate-50 p-2.5 rounded border border-slate-100">
            <strong className="text-slate-700">Terms / Notes:</strong> {invoice.notes}
          </p>
        )}

        {/* Signatures */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
          <div>
            <div className="h-10 border-b border-slate-300 w-36 mb-1"></div>
            <span className="text-[11px] font-medium text-slate-600">Customer Signature</span>
          </div>
          <div className="text-right">
            <div className="h-10 border-b border-slate-300 w-44 mb-1"></div>
            <span className="text-[11px] font-medium text-slate-600">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
