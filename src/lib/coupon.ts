export interface AppliedCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
}

export const calculateDiscount = (
  coupon: AppliedCoupon | null,
  subtotal: number,
): number => {
  if (!coupon) return 0;
  if (coupon.discountType === 'percentage') {
    return (subtotal * coupon.discountValue) / 100;
  }
  return Math.min(coupon.discountValue, subtotal);
};

export const isCouponEligible = (
  coupon: AppliedCoupon | null,
  subtotal: number,
): boolean => {
  if (!coupon) return true;
  return subtotal >= (coupon.minOrderValue ?? 0);
};
