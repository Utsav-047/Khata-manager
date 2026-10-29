import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Customer } from '../../types';
import { customerService } from '../../services/customerService';
import { useLanguage } from '../../context/LanguageContext';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: Customer | null;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setCustomerCode(customerToEdit.customerCode || '');
      setMobile(customerToEdit.mobile || '');
      setEmail(customerToEdit.email || '');
      setAddress(customerToEdit.address || '');
      setNotes(customerToEdit.notes || '');
      setOpeningBalance(customerToEdit.openingBalanceRupees ?? 0);
    } else {
      setName('');
      setCustomerCode('');
      setMobile('');
      setEmail('');
      setAddress('');
      setNotes('');
      setOpeningBalance(0);
    }
    setError('');
  }, [customerToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required');
      return;
    }

    // Mobile Validation (10 digits starting with 6-9)
    let cleanedMobile = mobile.trim().replace(/[\s\-()+]/g, '');
    if (cleanedMobile.startsWith('91') && cleanedMobile.length === 12) {
      cleanedMobile = cleanedMobile.slice(2);
    } else if (cleanedMobile.startsWith('0') && cleanedMobile.length === 11) {
      cleanedMobile = cleanedMobile.slice(1);
    }
    if (cleanedMobile && !/^[6-9]\d{9}$/.test(cleanedMobile)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    // Email Validation
    const cleanedEmail = email.trim().toLowerCase();
    if (cleanedEmail && !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(cleanedEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (customerToEdit) {
        await customerService.updateCustomer(customerToEdit._id, {
          name: name.trim(),
          mobile: cleanedMobile || undefined,
          email: cleanedEmail || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          openingBalance: openingBalance || 0,
        });
      } else {
        await customerService.createCustomer({
          name: name.trim(),
          customerCode: customerCode.trim() ? customerCode.trim() : undefined,
          mobile: cleanedMobile || undefined,
          email: cleanedEmail || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          openingBalance: openingBalance || 0,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customerToEdit ? t('editCustomer', 'Edit Customer Details') : t('addNewCustomer', 'Add New Customer')}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            {t('customerFullName', 'Customer Full Name *')}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder', 'e.g. Ramesh Patel or Kiran Kumar')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('customerCodeOptional', 'Customer Code (Optional)')}
            </label>
            <input
              type="text"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
              placeholder={t('autoGenerated', 'Auto-generated if empty')}
              disabled={!!customerToEdit}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-mono disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('customerMobile', 'Mobile Number')}
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder={t('mobilePlaceholder', 'e.g. 9876543210')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">10-digit Indian mobile number</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Email Address (Optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. customer@example.com"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            {t('customerAddress', 'Address / Village')}
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('addressPlaceholder', 'e.g. Village Rampur, Near Primary School')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        {!customerToEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('openingBalanceLabel', 'Opening Balance (₹)')}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={openingBalance === 0 ? '' : openingBalance}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOpeningBalance(isNaN(val) ? 0 : Math.max(0, val));
              }}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              {t('initialBalanceHelp', 'Initial balance at account opening (Default: ₹0.00)')}
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            {t('customerRemarks', 'Remarks / Notes')}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('remarksPlaceholder', 'Optional reference notes about the customer')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? t('saving', 'Saving...') : customerToEdit ? t('updateCustomer', 'Update Customer') : t('saveCustomer', 'Save Customer')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
