import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Product, CartItem, CartContextType } from '@/types/product';
import { AppliedCoupon, calculateDiscount, isCouponEligible } from '@/lib/coupon';

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'dbs-cart-v1';
const COUPON_STORAGE_KEY = 'dbs-coupon-v1';
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

const loadCoupon = (): AppliedCoupon | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COUPON_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed || typeof parsed.code !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveCoupon = (coupon: AppliedCoupon | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (coupon) window.localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
    else window.localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());
  const [coupon, setCouponState] = useState<AppliedCoupon | null>(() => loadCoupon());

  useEffect(() => {
    saveCart(items);
  }, [items]);

  useEffect(() => {
    saveCoupon(coupon);
  }, [coupon]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(loadCart());
      if (e.key === COUPON_STORAGE_KEY) setCouponState(loadCoupon());
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
    setCouponState(null);
  }, []);

  const applyCoupon = useCallback((next: AppliedCoupon | null) => {
    setCouponState(next);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  // Auto-removes a coupon that became ineligible (e.g. user reduced quantity below min order)
  useEffect(() => {
    if (coupon && !isCouponEligible(coupon, subtotal)) {
      setCouponState(null);
    }
  }, [coupon, subtotal]);

  const discount = useMemo(() => calculateDiscount(coupon, subtotal), [coupon, subtotal]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        total: subtotal,
        itemCount,
        coupon,
        applyCoupon,
        discount,
      }}
    >
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
