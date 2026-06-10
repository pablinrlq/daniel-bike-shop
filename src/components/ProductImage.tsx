import { useState, useEffect, type ImgHTMLAttributes } from 'react';

const PLACEHOLDER = '/placeholder.svg';

type ProductImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null;
  /** opcional: imagens de backup tentadas em ordem se a principal falhar */
  fallbacks?: Array<string | undefined | null>;
};

/**
 * <img> que cai num placeholder quando a URL do Bling quebra, expira,
 * ou bloqueia hotlink. Evita os "quadrados com alt text" do Bling.
 */
export const ProductImage = ({ src, fallbacks = [], alt, ...rest }: ProductImageProps) => {
  // Candidatos: src + fallbacks (em ordem), filtrando vazios/duplicados
  const candidates = [src, ...fallbacks, PLACEHOLDER]
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  const dedup = Array.from(new Set(candidates));

  const [index, setIndex] = useState(0);

  // Se a prop src mudar (ex.: trocar de produto), reseta pro primeiro candidato
  useEffect(() => {
    setIndex(0);
  }, [src]);

  const current = dedup[index] ?? PLACEHOLDER;

  return (
    <img
      {...rest}
      src={current}
      alt={alt ?? ''}
      onError={() => {
        if (index < dedup.length - 1) setIndex((i) => i + 1);
      }}
    />
  );
};

export default ProductImage;
