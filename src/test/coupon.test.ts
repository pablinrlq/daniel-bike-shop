import { describe, it, expect } from 'vitest';
import { calculateDiscount, isCouponEligible, AppliedCoupon } from '@/lib/coupon';

const PCT: AppliedCoupon = {
  code: 'BIKE10',
  discountType: 'percentage',
  discountValue: 10,
  minOrderValue: 0,
};

const FIXED: AppliedCoupon = {
  code: 'OFF50',
  discountType: 'fixed',
  discountValue: 50,
  minOrderValue: 200,
};

describe('coupon', () => {
  it('returns 0 when there is no coupon', () => {
    expect(calculateDiscount(null, 500)).toBe(0);
  });

  it('applies a percentage discount', () => {
    expect(calculateDiscount(PCT, 200)).toBe(20);
  });

  it('caps a fixed discount at the subtotal', () => {
    expect(calculateDiscount(FIXED, 30)).toBe(30);
    expect(calculateDiscount(FIXED, 1000)).toBe(50);
  });

  it('checks minimum order eligibility', () => {
    expect(isCouponEligible(FIXED, 199.99)).toBe(false);
    expect(isCouponEligible(FIXED, 200)).toBe(true);
    expect(isCouponEligible(null, 0)).toBe(true);
  });
});
