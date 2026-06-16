/**
 * Fotos OFICIAIS por produto, casadas por SKU.
 *
 * Para produtos que vieram sem foto do Bling, mas que a gente achou a foto
 * oficial do fabricante/loja na internet, baixou e VERIFICOU visualmente.
 * As imagens ficam em /public/produtos. Casamos por SKU porque é a chave
 * exata e estável (o nome pode mudar; o SKU não).
 *
 * Tem prioridade sobre o fallback de categoria ([[product-photo-fallback]]):
 *   foto própria do Bling > foto oficial por SKU > foto/plaquinha da categoria.
 *
 * Como NÃO grava no banco, sobrevive a qualquer sync do Bling.
 */
export const PRODUCT_IMAGE_OVERRIDES: Record<string, string> = {
  // ---- RAVA Go 29 (quadro MTB, kit completo — foto oficial RAVA por cor) ----
  '16603879609': '/produtos/rava-go-azul.webp', //     QUADRO 29 MTB RAVA GO 17" AZ CB
  '16603950665': '/produtos/rava-go-branco.webp', //   QUADRO 29 MTB RAVA GO 15.5" BR CB
  '16603950672': '/produtos/rava-go-preto.webp', //    QUADRO 29 MTB RAVA GO 17" PT CB
  '16603879622': '/produtos/rava-go-preto.webp', //    QUADRO 29 MTB RAVA GO 19" PT CB
  '16620334613': '/produtos/rava-go-verde.webp', //    QUADRO 29 MTB RAVA GO 17" VD CB
  '16620334603': '/produtos/rava-go-vermelho.webp', // QUADRO 29 MTB RAVA GO 17" VM CB
  '16620334608': '/produtos/rava-go-violeta.webp', //  QUADRO 29 MTB RAVA GO 17" VL CB
  '16603950659': '/produtos/rava-go-violeta.webp', //  QUADRO 29 MTB RAVA GO 15.5" VL CB
};

/** Foto oficial pra um SKU, se a gente tiver curado. */
export const overrideImageForSku = (sku?: string | null): string | undefined =>
  sku ? PRODUCT_IMAGE_OVERRIDES[sku] : undefined;
