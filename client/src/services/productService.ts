import api from './api';
import { Product } from '../types';

function mapProduct(raw: any): Product {
  const price = parseFloat(raw.unit_price ?? raw.defaultPriceRupees ?? 0);
  const stock = parseFloat(raw.current_stock ?? raw.currentStock ?? 0);
  const minStock = raw.min_stock_alert !== undefined ? parseFloat(raw.min_stock_alert) : (raw.minStockAlert !== undefined ? parseFloat(raw.minStockAlert) : 10);
  return {
    _id: String(raw.id ?? raw._id),
    productCode: raw.code ?? raw.productCode ?? `PRD-${raw.id || '0000'}`,
    name: raw.name || '',
    unit: raw.unit || 'pcs',
    defaultPrice: Math.round(price * 100),
    defaultPriceRupees: price,
    currentStock: stock,
    minStockAlert: minStock,
    description: raw.description ?? '',
    isActive: raw.is_active ?? raw.isActive ?? true,
  };
}

export const productService = {
  async getProducts(params?: { search?: string; status?: string; page?: number; limit?: number }): Promise<{ data: Product[]; total: number }> {
    const res = await api.get('/products', {
      params: {
        q: params?.search,
        active_only: params?.status === 'inactive' ? false : true,
      },
    });
    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const mapped = list.map(mapProduct);
    return { data: mapped, total: mapped.length };
  },

  async getProductById(id: string): Promise<Product> {
    const res = await api.get(`/products/${id}`);
    const raw = res.data?.data || res.data;
    return mapProduct(raw);
  },

  async createProduct(data: {
    name: string;
    productCode?: string;
    unit: string;
    defaultPrice: number;
    currentStock?: number;
    minStockAlert?: number;
    description?: string;
  }): Promise<Product> {
    const priceRupees = data.defaultPrice > 1000 ? data.defaultPrice / 100 : data.defaultPrice;
    const body: any = {
      name: data.name,
      unit: data.unit || 'pcs',
      unit_price: priceRupees,
      current_stock: data.currentStock !== undefined ? data.currentStock : 0,
      min_stock_alert: data.minStockAlert !== undefined ? data.minStockAlert : 10,
      description: data.description || undefined,
    };
    const res = await api.post('/products', body);
    const raw = res.data?.data || res.data;
    return mapProduct(raw);
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.unit !== undefined) body.unit = data.unit;
    if (data.defaultPriceRupees !== undefined) body.unit_price = data.defaultPriceRupees;
    else if (data.defaultPrice !== undefined) body.unit_price = data.defaultPrice > 1000 ? data.defaultPrice / 100 : data.defaultPrice;
    if (data.currentStock !== undefined) body.current_stock = data.currentStock;
    if (data.minStockAlert !== undefined) body.min_stock_alert = data.minStockAlert;
    if (data.description !== undefined) body.description = data.description;
    if (data.isActive !== undefined) body.is_active = data.isActive;

    const res = await api.patch(`/products/${id}`, body);
    const raw = res.data?.data || res.data;
    return mapProduct(raw);
  },

  async toggleProductStatus(id: string): Promise<Product> {
    const res = await api.patch(`/products/${id}/toggle-status`);
    const raw = res.data?.data || res.data;
    return mapProduct(raw);
  },
};
