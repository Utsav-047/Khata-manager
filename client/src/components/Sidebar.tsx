import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  PlusCircle,
  Receipt,
  CreditCard,
  Package,
  BarChart3,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user, isAdmin, logout } = useAuth();
  const { t } = useLanguage();

  const navItems = [
    { label: t('dashboard', 'Dashboard'), to: '/', icon: LayoutDashboard },
    { label: t('customers', 'Customer Accounts'), to: '/customers', icon: Users },
    { label: t('newInvoice', 'New Credit Sale'), to: '/invoices/new', icon: PlusCircle },
    { label: t('invoices', 'Invoices'), to: '/invoices', icon: FileText },
    { label: t('receivePayment', 'Receive Payment'), to: '/payments/new', icon: CreditCard },
    { label: t('payments', 'Payment Records'), to: '/payments', icon: Receipt },
    { label: t('products', 'Product Catalog'), to: '/products', icon: Package },
    { label: t('reports', 'Reports & Aging'), to: '/reports', icon: BarChart3 },
    ...(isAdmin
      ? [
          { label: t('staff', 'Staff Accounts'), to: '/staff', icon: ShieldCheck },
          { label: t('audit', 'Audit Trail'), to: '/audit-logs', icon: History },
          { label: t('settings', 'Settings'), to: '/settings', icon: Settings },
        ]
      : []),
  ];

  const handleLinkClick = () => {
    if (mobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
              K
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-tight">
                {t('appName', 'Khata Manager')}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase">
                {t('appSub', 'Credit & Ledger OS')}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            {t('mainMenu', 'Main Menu')}
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* User Profile Card & Logout */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-white block truncate">{user?.name || 'Staff User'}</span>
                <span className="text-[10px] text-slate-400 block capitalize">
                  {user?.role === 'admin' ? t('administrator', 'Administrator') : t('counterStaff', 'Counter Staff')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title={t('logout', 'Logout')}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
