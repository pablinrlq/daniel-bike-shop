import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Loader2, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppliedCoupon, calculateDiscount } from '@/lib/coupon';

export type { AppliedCoupon };

interface CouponInputProps {
  orderTotal: number;
  appliedCoupon: AppliedCoupon | null;
  onApplyCoupon: (coupon: AppliedCoupon | null) => void;
}

interface ValidateCouponResponse {
  valid: boolean;
  error?: string;
  message?: string;
  code?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minOrderValue?: number;
  discountAmount?: number;
}

const CouponInput = ({ orderTotal, appliedCoupon, onApplyCoupon }: CouponInputProps) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Digite um código de cupom');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ValidateCouponResponse>(
        'validate-coupon',
        { body: { code: trimmed, subtotal: orderTotal } },
      );

      if (error) throw error;

      if (!data || !data.valid || !data.code || !data.discountType || typeof data.discountValue !== 'number') {
        toast.error(data?.message || 'Cupom inválido ou expirado');
        return;
      }

      onApplyCoupon({
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderValue: data.minOrderValue ?? 0,
      });

      toast.success('Cupom aplicado com sucesso!');
      setCode('');
    } catch (err) {
      console.error('Coupon error:', err);
      toast.error('Erro ao aplicar cupom. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    onApplyCoupon(null);
    toast.info('Cupom removido');
  };

  if (appliedCoupon) {
    const discountAmount = calculateDiscount(appliedCoupon, orderTotal);

    return (
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              {appliedCoupon.code}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
          {appliedCoupon.discountType === 'percentage'
            ? `${appliedCoupon.discountValue}% de desconto`
            : `R$ ${appliedCoupon.discountValue.toFixed(2)} de desconto`}
          {' • '}
          <span className="font-semibold">-R$ {discountAmount.toFixed(2)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Tag className="h-4 w-4" />
        <span>Tem um cupom de desconto?</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Digite o código"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          className="flex-1 uppercase"
          disabled={isLoading}
        />
        <Button
          onClick={handleApply}
          variant="outline"
          disabled={isLoading || !code.trim()}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
};

export default CouponInput;
