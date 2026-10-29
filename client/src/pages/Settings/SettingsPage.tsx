import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, KeyRound, CheckCircle, AlertCircle, Languages, Trash2, AlertTriangle } from 'lucide-react';
import { settingService } from '../../services/settingService';
import { authService } from '../../services/authService';
import { BusinessSetting } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { language, setLanguage, t, isGujarati } = useLanguage();
  const [settings, setSettings] = useState<BusinessSetting>({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    gstNumber: '',
    currencySymbol: '₹',
    allowAdvancePayments: true,
    defaultCreditPeriodDays: 30,
    invoiceNote: '',
  });

  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Clear history state
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleResetHistory = async () => {
    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      await settingService.resetHistory();
      setResetConfirmOpen(false);
      setResetMessage(
        isGujarati
          ? 'તમામ વ્યવહાર હિસાબ રદ કરવામાં આવ્યા છે અને બધું ૦ પર સેટ થઈ ગયું છે!'
          : 'All transaction history successfully cleared and initial balances reset to 0!'
      );
      setTimeout(() => setResetMessage(''), 5000);
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'Failed to clear history');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingService.getSettings();
        if (data) setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    try {
      const updated = await settingService.updateSettings(settings);
      setSettings(updated);
      setSaveSuccess('Business settings updated successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setSaveError(err.response?.data?.message || 'Failed to update settings');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters');
      return;
    }

    setPassLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPassSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err: any) {
      setPassError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('settings', 'Application Settings')}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {isGujarati ? 'સિસ્ટમ ભાષા, પ્રમાણિત ખાતાવહી પરિભાષા અને વેપાર વિગતો ગોઠવો.' : 'Configure language preferences, standard accounting terms, and business details.'}
        </p>
      </div>

      {/* Language & Terminology Selector Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Languages className="w-4 h-4 text-emerald-600" />
            <span>{isGujarati ? 'ભાષા અને પ્રમાણિત પરિભાષા (Language & Terms)' : 'Language & Standard Terminology'}</span>
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {language === 'gu' ? 'ગુજરાતી સક્રિય' : 'English Active'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {isGujarati
            ? 'તમારી પસંદગી મુજબ એપ્લિકેશનની ભાષા પસંદ કરો. ગુજરાતી મોડમાં તમામ ખાતાવહી શબ્દો (ઉધાર, જમા, બાકી રકમ, શરૂઆતની બાકી) શુદ્ધ પ્રમાણિત ગુજરાતીમાં પ્રદર્શિત થશે.'
            : 'Select your preferred application language. In English, clean standard accounting terminology (Debit, Credit, Outstanding Balance, Opening Balance, Running Balance) is strictly enforced.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-4 rounded-xl border text-left transition-all ${
              language === 'en'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">🇬🇧 English</span>
              {language === 'en' && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Active</span>}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Standard Accounting: <strong>Debit, Credit, Outstanding Balance, Opening Balance (₹0.00), Running Balance, Fully Settled.</strong>
            </p>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('gu')}
            className={`p-4 rounded-xl border text-left transition-all ${
              language === 'gu'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">🇮🇳 ગુજરાતી (Gujarati)</span>
              {language === 'gu' && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">સક્રિય</span>}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              પ્રમાણિત ખાતાવહી: <strong>ઉધાર (વેચાણ), જમા (ચુકવણી), કુલ બાકી રકમ, શરૂઆતની બાકી (₹૦.૦૦), ચાલુ બાકી, હિસાબ ચુકતે.</strong>
            </p>
          </button>
        </div>
      </div>

      {/* Business Details Form (Admin Only) */}
      {isAdmin && (
        <form onSubmit={handleSettingsSubmit} className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <SettingsIcon className="w-4 h-4 text-emerald-600" />
              <span>Business Profile & Receipt Header</span>
            </h3>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Business / Store Name *
              </label>
              <input
                type="text"
                required
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Owner / Authorized Person
              </label>
              <input
                type="text"
                value={settings.ownerName}
                onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official Phone / Mobile
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={settings.gstNumber}
                onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value.toUpperCase() })}
                placeholder="e.g. 09AAACK1234B1Z5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Business Address (Printed on invoices)
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Invoice Footer Notice / Payment Note
              </label>
              <textarea
                rows={2}
                value={settings.invoiceNote}
                onChange={(e) => setSettings({ ...settings, invoiceNote: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Business Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Password Change Form */}
      <form onSubmit={handlePasswordSubmit} className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>Change My Password</span>
          </h3>
        </div>

        {passSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{passSuccess}</span>
          </div>
        )}
        {passError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={passLoading}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {passLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* Danger Zone: Clear History (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl p-5 border border-rose-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <h3 className="text-sm font-bold text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{isGujarati ? 'ડેન્જર ઝોન: તમામ વ્યવહાર હિસાબ રદ કરો' : 'Danger Zone: Clear Transaction History'}</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase">
              {isGujarati ? 'એડમિન માત્ર' : 'Admin Only'}
            </span>
          </div>

          {resetMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {resetError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resetError}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            {isGujarati
              ? 'આ બટન ક્લિક કરવાથી તમામ ઉધાર બિલ, જમા રકમ, પાવતીઓ અને ઓડિટ લોગ ડેટાબેઝમાંથી સંપૂર્ણ સાફ થઈ જશે અને તમામ ગ્રાહકોની બાકી રકમ ૦ થઈ જશે.'
              : 'Wipe all historical invoices, payment vouchers, allocations, credit adjustments, and audit trail logs. Customer balances will be cleanly reset to initial 0.'}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm shadow-rose-600/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isGujarati ? 'તમામ હિસાબ સાફ કરો (Reset to 0)' : 'Clear All Transaction History (Reset to 0)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetHistory}
        title={isGujarati ? 'તમામ વ્યવહાર હિસાબ સાફ કરવો છે?' : 'Clear All Transaction History?'}
        message={
          isGujarati
            ? 'શું તમે ખરેખર તમામ ઉધાર બિલ, જમા રકમ અને જૂનો હિસાબ સાફ કરવા માંગો છો? આ ક્રિયા પછી બધું પ્રારંભિક ૦ થઈ જશે.'
            : 'Are you sure you want to permanently clear all invoices, payments, and transaction history? All customer balances will be reset to 0.00. This cannot be undone.'
        }
        confirmLabel={isGujarati ? 'હા, બધું સાફ કરો' : 'Yes, Clear All History'}
        isDestructive={true}
        loading={resetLoading}
      />
    </div>
  );
};
