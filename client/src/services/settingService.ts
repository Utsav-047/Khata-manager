import api from './api';
import { BusinessSetting } from '../types';

export const settingService = {
  async getSettings(): Promise<BusinessSetting> {
    const res = await api.get('/settings');
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return {
      businessName: map['business_name'] || 'Khata Management System',
      ownerName: map['owner_name'] || 'Business Owner',
      phone: map['phone'] || '9876543210',
      email: map['email'] || 'admin@khata.local',
      address: map['address'] || '123 Market Road',
      gstNumber: map['gst_number'] || '',
      currencySymbol: map['currency_symbol'] || '₹',
      allowAdvancePayments: map['allow_advance_payments'] !== 'false',
      defaultCreditPeriodDays: parseInt(map['credit_period_days'] || '30', 10),
      invoiceNote: map['invoice_note'] || 'Thank you for your business!',
    };
  },

  async updateSettings(data: Partial<BusinessSetting>): Promise<BusinessSetting> {
    const updates: Array<{ key: string; value: string }> = [];
    if (data.businessName !== undefined) updates.push({ key: 'business_name', value: data.businessName });
    if (data.ownerName !== undefined) updates.push({ key: 'owner_name', value: data.ownerName });
    if (data.phone !== undefined) updates.push({ key: 'phone', value: data.phone });
    if (data.email !== undefined) updates.push({ key: 'email', value: data.email });
    if (data.address !== undefined) updates.push({ key: 'address', value: data.address });
    if (data.gstNumber !== undefined) updates.push({ key: 'gst_number', value: data.gstNumber });
    if (data.currencySymbol !== undefined) updates.push({ key: 'currency_symbol', value: data.currencySymbol });
    if (data.allowAdvancePayments !== undefined) updates.push({ key: 'allow_advance_payments', value: String(data.allowAdvancePayments) });
    if (data.defaultCreditPeriodDays !== undefined) updates.push({ key: 'credit_period_days', value: String(data.defaultCreditPeriodDays) });
    if (data.invoiceNote !== undefined) updates.push({ key: 'invoice_note', value: data.invoiceNote });

    await api.put('/settings', updates);
    return this.getSettings();
  },

  async resetHistory(): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/settings/reset-history');
    return res.data;
  },
};
