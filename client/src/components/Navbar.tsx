import React from 'react';
import { Menu, PlusCircle, CreditCard, ShieldCheck, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface NavbarProps {
  setMobileOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ setMobileOpen }) => {
  const { user, isAdmin } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {t('appHeaderSubtitle', 'Credit Ledger & Accounting System')}
          </span>
          <h1 className="text-sm font-bold text-slate-800">{t('appHeaderTitle', 'Kisan Krishi Seva Kendra')}</h1>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Language Switcher */}
        <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/80 text-xs">
          <div className="flex items-center px-1.5 py-1 text-slate-400">
            <Languages className="w-3.5 h-3.5" />
          </div>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all ${
              language === 'en'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('gu')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all ${
              language === 'gu'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="ગુજરાતી (Gujarati)"
          >
            ગુજરાતી
          </button>
        </div>

        {/* Quick action: Record Payment */}
        <button
          type="button"
          onClick={() => navigate('/payments/new')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-sm"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('quickReceive', 'Receive Payment')}</span>
          <span className="sm:hidden">{t('creditShort', 'Credit')}</span>
        </button>

        {/* Quick action: New Credit Sale */}
        <button
          type="button"
          onClick={() => navigate('/invoices/new')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('quickSale', 'New Credit Sale')}</span>
          <span className="sm:hidden">{t('debitShort', 'Sale')}</span>
        </button>

        {/* User Role Tag */}
        <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-slate-200 text-xs">
          {isAdmin ? (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3 h-3" />
              <span>{t('adminRole', 'Admin')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
              {t('staffRole', 'Staff')}
            </span>
          )}
          <span className="text-slate-600 font-medium">{user?.name}</span>
        </div>
      </div>
    </header>
  );
};
