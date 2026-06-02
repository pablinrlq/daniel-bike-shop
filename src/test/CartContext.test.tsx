import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from '@/contexts/CartContext';
import type { Product } from '@/types/product';
import type { AppliedCoupon } from '@/lib/coupon';

const bike: Product = {
  id: 'p1',
  name: 'Mountain Bike Aro 29',
  description: 'MTB',
  price: 1000,
  category: 'bicicletas',
  image: '',
  stock: 5,
};

const helmet: Product = {
  id: 'p2',
  name: 'Capacete',
  description: 'Capacete MTB',
  price: 200,
  category: 'acessorios',
  image: '',
  stock: 10,
};

const PCT_COUPON: AppliedCoupon = {
  code: 'BIKE10',
  discountType: 'percentage',
  discountValue: 10,
  minOrderValue: 0,
};

const MIN_500_COUPON: AppliedCoupon = {
  code: 'OFF50',
  discountType: 'fixed',
  discountValue: 50,
  minOrderValue: 500,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

describe('CartContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds an item and increments the quantity on re-add', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(bike));
    act(() => result.current.addToCart(bike));

    expect(result.current.itemCount).toBe(2);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.total).toBe(2000);
  });

  it('updates the quantity and removes when zeroed', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(bike));
    act(() => result.current.updateQuantity('p1', 3));
    expect(result.current.itemCount).toBe(3);

    act(() => result.current.updateQuantity('p1', 0));
    expect(result.current.items).toHaveLength(0);
  });

  it('computes the percentage discount via the context', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(bike));
    act(() => result.current.applyCoupon(PCT_COUPON));

    expect(result.current.coupon?.code).toBe('BIKE10');
    expect(result.current.discount).toBe(100);
  });

  it('auto-removes a coupon when the cart drops below the minimum', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(bike));
    act(() => result.current.applyCoupon(MIN_500_COUPON));
    expect(result.current.coupon).not.toBeNull();

    // Lower the cart below the coupon minimum (500) by removing the bike
    act(() => result.current.removeFromCart('p1'));
    act(() => result.current.addToCart(helmet));

    expect(result.current.coupon).toBeNull();
    expect(result.current.discount).toBe(0);
  });

  it('clears the cart and the coupon together', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addToCart(bike));
    act(() => result.current.applyCoupon(PCT_COUPON));
    act(() => result.current.clearCart());

    expect(result.current.items).toHaveLength(0);
    expect(result.current.coupon).toBeNull();
  });
});
