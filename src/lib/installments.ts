// Parcelamento "sem juros" — usado no card, na página do produto e no "Quero esse".
// Mantém o discurso do site (selo "21x sem juros") consistente em todo lugar.

export const MAX_INSTALLMENTS = 21;
// Valor mínimo por parcela (evita "21x de R$ 0,95" em produtos baratos).
const MIN_INSTALLMENT_VALUE = 50;

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export interface Installment {
  count: number;
  value: number;
  /** Ex.: "21x de R$ 173,81 sem juros" */
  label: string;
}

/**
 * Melhor parcelamento sem juros para um preço: o maior número de parcelas
 * (até MAX_INSTALLMENTS) em que cada parcela fica >= MIN_INSTALLMENT_VALUE.
 * Retorna null quando nem 2x compensa (produto barato demais).
 */
export const bestInstallment = (price: number): Installment | null => {
  if (!price || price <= 0) return null;
  const count = Math.min(MAX_INSTALLMENTS, Math.floor(price / MIN_INSTALLMENT_VALUE));
  if (count < 2) return null;
  const value = price / count;
  return { count, value, label: `${count}x de ${brl(value)} sem juros` };
};
