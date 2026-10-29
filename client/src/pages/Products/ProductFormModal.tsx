import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Product } from '../../types';
import { productService } from '../../services/productService';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
}) => {
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [unit, setUnit] = useState('Bags');
  const [defaultPrice, setDefaultPrice] = useState<number | ''>('');
  const [currentStock, setCurrentStock] = useState<number | ''>('');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setProductCode(productToEdit.productCode || '');
      setUnit(productToEdit.unit || 'Bags');
      setDefaultPrice(productToEdit.defaultPriceRupees !== undefined ? productToEdit.defaultPriceRupees : '');
      setCurrentStock(productToEdit.currentStock !== undefined ? productToEdit.currentStock : '');
      setMinStockAlert(productToEdit.minStockAlert !== undefined ? productToEdit.minStockAlert : 10);
      setDescription(productToEdit.description || '');
    } else {
      setName('');
      setProductCode('');
      setUnit('Bags');
      setDefaultPrice('');
      setCurrentStock('');
      setMinStockAlert(10);
      setDescription('');
    }
    setError('');
  }, [productToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    const priceNum = defaultPrice === '' ? 0 : Number(defaultPrice);
    const stockNum = currentStock === '' ? 0 : Number(currentStock);
    const minAlertNum = minStockAlert === '' ? 10 : Number(minStockAlert);

    if (priceNum < 0) {
      setError('Price cannot be negative');
      return;
    }
    if (stockNum < 0) {
      setError('Stock quantity cannot be negative');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (productToEdit) {
        await productService.updateProduct(productToEdit._id, {
          name,
          unit,
          defaultPrice: priceNum,
          currentStock: stockNum,
          minStockAlert: minAlertNum,
          description,
        });
      } else {
        await productService.createProduct({
          name,
          productCode: productCode.trim() ? productCode.trim() : undefined,
          unit,
          defaultPrice: priceNum,
          currentStock: stockNum,
          minStockAlert: minAlertNum,
          description,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? 'Edit Product Catalog Item' : 'Add New Product to Catalog'}
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
            Product Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Urea (Neem Coated) or DAP"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Product Code (Optional)
            </label>
            <input
              type="text"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value.toUpperCase())}
              placeholder="e.g. PROD-0001 (Auto if empty)"
              disabled={!!productToEdit}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-mono disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Unit of Measurement *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900"
            >
              <option value="Bags">Bags</option>
              <option value="Kg">Kilograms (Kg)</option>
              <option value="Liters">Liters (L)</option>
              <option value="Pieces">Pieces (Pcs)</option>
              <option value="Bottles">Bottles</option>
              <option value="Packets">Packets</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Default Unit Price (₹) *
          </label>
          <input
            type="number"
            step="any"
            min="0"
            required
            value={defaultPrice}
            onChange={(e) => {
              const val = e.target.value;
              setDefaultPrice(val === '' ? '' : parseFloat(val));
            }}
            placeholder="0.00"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-semibold"
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            This price will auto-fill in invoices. You can always override prices per invoice.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Total Stock Quantity ({unit}) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={currentStock}
              onChange={(e) => {
                const val = e.target.value;
                setCurrentStock(val === '' ? '' : parseFloat(val));
              }}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Reduces automatically when sales invoices are generated.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Low Stock Alert ({unit})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={minStockAlert}
              onChange={(e) => {
                const val = e.target.value;
                setMinStockAlert(val === '' ? '' : parseFloat(val));
              }}
              placeholder="10"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Warns when stock falls below this threshold.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 45kg standard neem coated agricultural urea"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : productToEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
