import React from 'react';
import { Printer, Share2 } from 'lucide-react';
import { Modal } from './Modal';
import { PaymentRecord, BusinessSetting } from '../types';
import { formatINR, formatDateTime } from '../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  settings?: BusinessSetting | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  settings,
}) => {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const customerName = typeof payment.customerId === 'object' ? payment.customerId?.name : 'Customer';
  const customerCode = typeof payment.customerId === 'object' ? payment.customerId?.customerCode : '';
  const customerMobile = typeof payment.customerId === 'object' ? payment.customerId?.mobile : '';

  const handleShareWhatsApp = () => {
    const business = settings?.businessName || 'Kisan Krishi Seva Kendra';
    const msg = `🌾 *${business}*\n` +
      `--------------------------------\n` +
      `🧾 *PAYMENT RECEIPT: ${payment.receiptNumber}*\n` +
      `📅 Date: ${formatDateTime(payment.paymentDate)}\n` +
      `👤 Customer: ${customerName}${customerCode ? ` (${customerCode})` : ''}\n` +
      `--------------------------------\n` +
      `💵 *Amount Received: ₹${payment.amountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` +
      `💳 Payment Mode: ${payment.paymentMethod || 'CASH'}\n` +
      `--------------------------------\n` +
      `Payment recorded in your account ledger. Thank you!`;

    const cleanMobile = customerMobile ? customerMobile.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanMobile ? (cleanMobile.startsWith('91') && cleanMobile.length === 12 ? cleanMobile : (cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile)) : '';
    const url = `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Receipt" maxWidth="lg">
      <div className="flex justify-end space-x-2 mb-3 no-print">
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          title="Share receipt directly to customer on WhatsApp"
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
          <span>Print Receipt</span>
        </button>
      </div>

      <div id="printable-area" className="p-6 bg-white border border-slate-200 rounded-xl font-sans text-slate-800">
        {/* Header */}
        <div className="text-center border-b border-slate-200 pb-4 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {settings?.businessName || 'Kisan Krishi Seva Kendra'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings?.address || 'Main Mandi Road, Agricultural Hub'}
          </p>
          <p className="text-xs text-slate-500">
            Contact: {settings?.phone || '+91 98765 43210'} {settings?.gstNumber ? `| GSTIN: ${settings.gstNumber}` : ''}
          </p>
          <div className="inline-block mt-3 px-3 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold uppercase tracking-wider rounded">
            Official Payment Receipt
          </div>
        </div>

        {/* Receipt Info */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-5">
          <div>
            <span className="text-slate-400 block font-medium">Receipt No:</span>
            <span className="font-semibold text-slate-900 text-sm font-mono">{payment.receiptNumber}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-medium">Date & Time:</span>
            <span className="font-semibold text-slate-800">{formatDateTime(payment.paymentDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Received From:</span>
            <span className="font-bold text-slate-900 text-sm">{customerName}</span>
            <span className="block text-slate-500">Code: {customerCode} {customerMobile ? `| Mob: ${customerMobile}` : ''}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-medium">Payment Mode:</span>
            <span className="font-semibold text-slate-800">{payment.paymentMethod}</span>
            {payment.referenceNumber && (
              <span className="block text-slate-500 font-mono">Ref: {payment.referenceNumber}</span>
            )}
          </div>
        </div>

        {/* Amount Box */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center mb-5">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Amount Received</span>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">
            {formatINR(payment.amountRupees)}
          </div>
        </div>

        {/* Allocations breakdown if any */}
        {payment.allocations && payment.allocations.length > 0 ? (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Invoice Allocation Breakdown
            </h4>
            <table className="w-full text-xs border border-slate-200 rounded">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 px-3 text-left">Invoice No</th>
                  <th className="py-2 px-3 text-right">Allocated Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payment.allocations.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 px-3 font-mono font-medium">
                      {typeof a.invoiceId === 'object' ? a.invoiceId?.invoiceNumber : 'Invoice'}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {formatINR(a.allocatedAmountRupees)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mb-4">
            * Simple payment credited directly to customer's running Khata balance.
          </p>
        )}

        {payment.notes && (
          <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded border border-slate-100">
            <strong className="text-slate-700">Notes:</strong> {payment.notes}
          </p>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
          <div>
            <span>Served By: {payment.createdBy?.name || 'Staff'}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Computer generated receipt.</p>
          </div>
          <div className="text-right">
            <div className="h-10 border-b border-slate-300 w-36 mb-1"></div>
            <span className="text-[11px] font-medium text-slate-600">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
