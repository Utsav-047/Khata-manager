import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Package, Filter, Download } from 'lucide-react';
import { productService } from '../../services/productService';
import { Product } from '../../types';
import { ProductFormModal } from './ProductFormModal';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatINR } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportHelper';

export const ProductsList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Product | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productService.getProducts({
        search: search.trim() || undefined,
        status: statusFilter,
        limit: 100,
      });
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleExportCSV = () => {
    const headers = ['Product Code', 'Product Name', 'Unit', 'Default Rate (₹)', 'Current Stock', 'Low Alert Limit', 'Description', 'Status'];
    const rows = products.map((p) => [
      p.productCode,
      p.name,
      p.unit,
      p.defaultPriceRupees,
      p.currentStock,
      p.minStockAlert ?? 10,
      p.description || '',
      p.isActive ? 'Active' : 'Inactive',
    ]);
    exportToCSV(`products_catalog_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    setToggleLoading(true);
    try {
      await productService.toggleProductStatus(confirmToggle._id);
      setConfirmToggle(null);
      fetchProducts();
    } catch (err) {
      console.error('Failed to toggle product status:', err);
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain standard products (Urea, DAP, Seeds, Fertilizers) and default billing rates.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setProductToEdit(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or code (e.g. Urea or DAP)..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-700"
          >
            <option value="active">Active Products Only</option>
            <option value="all">All Products</option>
            <option value="inactive">Inactive / Discontinued</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products in catalog"
          description="Add items like fertilizers, seeds, and chemicals with default prices."
          actionLabel="Add Product Now"
          onAction={() => {
            setProductToEdit(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Mobile Cards View (< 768px) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {products.map((p) => {
              const isOutOfStock = p.currentStock <= 0;
              const isLowStock = !isOutOfStock && p.currentStock <= (p.minStockAlert ?? 10);

              return (
                <div key={p._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {p.productCode}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Unit: {p.unit} {p.description && `• ${p.description}`}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-slate-900 text-base block">
                        {formatINR(p.defaultPriceRupees)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">per {p.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock (0)
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Low: {p.currentStock.toLocaleString()} {p.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Stock: {p.currentStock.toLocaleString()} {p.unit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProductToEdit(p);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmToggle(p)}
                        className={`text-xs font-medium px-2 py-1 ${
                          p.isActive ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Default Rate (₹)</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isOutOfStock = p.currentStock <= 0;
                  const isLowStock = !isOutOfStock && p.currentStock <= (p.minStockAlert ?? 10);
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{p.productCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                        {formatINR(p.defaultPriceRupees)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            0 {p.unit} (Out of Stock)
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {p.currentStock.toLocaleString()} {p.unit} (Low)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {p.currentStock.toLocaleString()} {p.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{p.description || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={p.isActive ? 'emerald' : 'slate'}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setProductToEdit(p);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmToggle(p)}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                          p.isActive
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProductFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchProducts}
        productToEdit={productToEdit}
      />

      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleStatus}
        title={confirmToggle?.isActive ? 'Deactivate Product?' : 'Activate Product?'}
        message={`Are you sure you want to ${confirmToggle?.isActive ? 'deactivate' : 'activate'} ${confirmToggle?.name}? Past invoices referencing this product will retain full integrity.`}
        confirmLabel={confirmToggle?.isActive ? 'Deactivate' : 'Activate'}
        isDestructive={confirmToggle?.isActive}
        loading={toggleLoading}
      />
    </div>
  );
};
