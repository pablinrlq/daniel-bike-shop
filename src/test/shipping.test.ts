import { describe, it, expect } from 'vitest';
import {
  calculateShipping,
  hasEarnedFreeShipping,
  FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING_COST,
} from '@/lib/shipping';

describe('shipping', () => {
  it('charges the flat fee below the threshold', () => {
    expect(calculateShipping(0)).toBe(FLAT_SHIPPING_COST);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(FLAT_SHIPPING_COST);
  });

  it('is free at or above the threshold', () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD + 100)).toBe(0);
  });

  it('reports free-shipping eligibility', () => {
    expect(hasEarnedFreeShipping(FREE_SHIPPING_THRESHOLD - 0.01)).toBe(false);
    expect(hasEarnedFreeShipping(FREE_SHIPPING_THRESHOLD)).toBe(true);
  });
});
