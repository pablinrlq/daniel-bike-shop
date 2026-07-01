import { describe, it, expect } from 'vitest';
import { bestInstallment, MAX_INSTALLMENTS } from './installments';

describe('bestInstallment', () => {
  it('limita a 21x em produtos caros', () => {
    const r = bestInstallment(3650);
    expect(r).not.toBeNull();
    expect(r!.count).toBe(MAX_INSTALLMENTS);
    expect(r!.value).toBeCloseTo(3650 / 21, 2);
    expect(r!.label).toContain('21x');
    expect(r!.label).toContain('sem juros');
  });

  it('reduz as parcelas para manter o mínimo por parcela (R$ 50)', () => {
    expect(bestInstallment(999)!.count).toBe(19); // floor(999 / 50)
    expect(bestInstallment(100)!.count).toBe(2);
  });

  it('não parcela quando nem 2x compensa', () => {
    expect(bestInstallment(80)).toBeNull();
    expect(bestInstallment(0)).toBeNull();
    expect(bestInstallment(-10)).toBeNull();
  });
});
