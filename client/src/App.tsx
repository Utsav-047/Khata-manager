import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CustomersList } from './pages/Customers/CustomersList';
import { CustomerLedger } from './pages/Customers/CustomerLedger';
import { ProductsList } from './pages/Products/ProductsList';
import { CreateInvoice } from './pages/Transactions/CreateInvoice';
import { InvoicesList } from './pages/Transactions/InvoicesList';
import { RecordPayment } from './pages/Payments/RecordPayment';
import { PaymentsList } from './pages/Payments/PaymentsList';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { StaffList } from './pages/Staff/StaffList';
import { AuditLogsList } from './pages/AuditLogs/AuditLogsList';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { NotFound } from './pages/NotFound';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomersList />} />
            <Route path="customers/:id/ledger" element={<CustomerLedger />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="invoices" element={<InvoicesList />} />
            <Route path="invoices/new" element={<CreateInvoice />} />
            <Route path="payments" element={<PaymentsList />} />
            <Route path="payments/new" element={<RecordPayment />} />
            <Route path="reports" element={<ReportsPage />} />

            {/* Admin Only Routes */}
            <Route
              path="staff"
              element={
                <ProtectedRoute requireAdmin>
                  <StaffList />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute requireAdmin>
                  <AuditLogsList />
                </ProtectedRoute>
              }
            />
            <Route path="settings" element={<SettingsPage />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
