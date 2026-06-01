import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product, CartItem, CartContextType } from '@/types/product';

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'dbs-cart-v1';
const MAX_QUANTITY_PER_ITEM = 99;

type StoredCartItem = { productId: string; product: Product; quantity: number };

const loadCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && entry.product && typeof entry.quantity === 'number')
      .map((entry) => ({ product: entry.product, quantity: Math.max(1, Math.min(MAX_QUANTITY_PER_ITEM, Math.floor(entry.quantity))) }));
  } catch (error) {
    console.warn('Falha ao restaurar carrinho do storage:', error);
    return [];
  }
};

const saveCart = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredCartItem[] = items.map((item) => ({
      productId: item.product.id,
      product: item.product,
      quantity: item.quantity,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Falha ao persistir carrinho:', error);
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    saveCart(items);
  }, [items]);

  // Sincroniza entre abas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(loadCart());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addToCart = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const next = Math.min(MAX_QUANTITY_PER_ITEM, existing.quantity + 1);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: next } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      const clamped = Math.min(MAX_QUANTITY_PER_ITEM, Math.floor(quantity));
      setItems((prev) =>
        prev.map((item) => (item.product.id === productId ? { ...item, quantity: clamped } : item)),
      );
    },
    [removeFromCart],
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
