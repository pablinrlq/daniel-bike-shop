export const FREE_SHIPPING_THRESHOLD = 299;
export const FLAT_SHIPPING_COST = 29.9;

export const calculateShipping = (subtotal: number): number => {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
};

export const hasEarnedFreeShipping = (subtotal: number): boolean => {
  return subtotal >= FREE_SHIPPING_THRESHOLD;
};
