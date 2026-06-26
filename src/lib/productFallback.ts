/**
 * Fallback de imagem por categoria — inferida pelo NOME do produto.
 *
 * Muitos produtos sincronizados do Bling vêm sem foto. Em vez de mostrar o
 * quadrado cinza do placeholder (ou pior, uma foto aleatória da internet que
 * pode ser de OUTRO produto), a gente lê o nome, descobre o tipo da peça e
 * mostra uma "plaquinha" limpa, na cor da marca, com o ícone e o nome da
 * categoria. Sempre carrega, nunca mostra o produto errado e sobrevive aos
 * syncs do Bling (o sync só mexe nas imagens quando o Bling tem foto).
 *
 * É tudo gerado em SVG (data URI), então não depende de arquivo externo nem
 * de URL que pode expirar.
 */

// Cor primária da marca (laranja) — igual ao --primary do index.css (22 92% 52%).
const BRAND = '#F2700F';
const PANEL = '#FBF8F3';
const PANEL_BORDER = '#EFE9E0';
const LABEL_COLOR = '#241F1A';
const CAPTION_COLOR = '#A2978A';

/**
 * Ícones desenhados num grid 0..100 (stroke, sem fill).
 * São propositalmente simples — a "plaquinha" comunica pelo rótulo; o ícone
 * é só um reforço visual do tipo de peça.
 */
const ICONS: Record<string, string> = {
  // Bicicleta / quadro / suspensão / garfo
  bike: `
    <circle cx="24" cy="70" r="18"/>
    <circle cx="78" cy="70" r="18"/>
    <path d="M24 70 L42 36 H64 M42 36 L62 70 M78 70 L60 40 M42 36 L38 26 H30 M58 36 L70 30"/>`,
  // Roda / aro / pneu / câmara / raio / niple / cubo
  wheel: `
    <circle cx="50" cy="50" r="40"/>
    <circle cx="50" cy="50" r="8"/>
    <path d="M50 10 V90 M10 50 H90 M22 22 L78 78 M78 22 L22 78"/>`,
  // Câmbio / corrente / cassete / pedivela / movimento central
  gear: `
    <circle cx="50" cy="50" r="22"/>
    <circle cx="50" cy="50" r="9"/>
    <path d="M50 20 V12 M50 80 V88 M20 50 H12 M80 50 H88 M31 31 L25 25 M69 31 L75 25 M31 69 L25 75 M69 69 L75 75"/>`,
  // Freio / disco / rotor
  brake: `
    <circle cx="44" cy="50" r="33" stroke-dasharray="6 6"/>
    <circle cx="44" cy="50" r="7"/>
    <rect x="66" y="38" width="16" height="24" rx="3"/>`,
  // Guidão / mesa / selim / canote / manopla
  cockpit: `
    <path d="M16 42 Q50 24 84 42 Q60 54 50 54 Q30 54 16 42 Z"/>
    <path d="M50 54 V84"/>`,
  // Cabo / conduíte / terminal
  cable: `
    <path d="M16 50 Q30 26 46 50 T76 50"/>
    <rect x="6" y="43" width="11" height="14" rx="2"/>
    <rect x="80" y="43" width="11" height="14" rx="2"/>`,
  // Capacete
  helmet: `
    <path d="M14 60 a36 34 0 0 1 72 0 Z"/>
    <path d="M14 60 H86 M24 52 Q32 42 42 42 M50 42 Q60 44 66 52"/>`,
  // Vestuário / luva / sapatilha
  apparel: `
    <path d="M36 20 L18 32 L27 46 L34 41 V82 H66 V41 L73 46 L82 32 L64 20 Q50 33 36 20 Z"/>`,
  // Lubrificante / graxa / óleo / selante
  lube: `
    <path d="M50 14 C50 14 26 46 26 62 a24 24 0 0 0 48 0 C74 46 50 14 50 14 Z"/>`,
  // Ferramenta / chave / reparo
  tool: `
    <path d="M24 78 L54 48 a16 16 0 1 1 10 10 L34 88 a7 7 0 0 1 -10 -10 Z"/>
    <circle cx="68" cy="34" r="3"/>`,
  // Genérico / acessório / cesta
  box: `
    <path d="M50 12 L84 30 V70 L50 88 L16 70 V30 Z M16 30 L50 48 L84 30 M50 48 V88"/>`,
};

interface CategoryDef {
  key: string;
  /** Testado contra o nome em MAIÚSCULAS, sem acento. Primeiro match vence. */
  test: RegExp;
  label: string;
  icon: keyof typeof ICONS;
  /** Foto real (verificada, em /public/categorias) pra categorias visuais.
      Sem isso, cai na plaquinha SVG da categoria. */
  photo?: string;
}

// Fotos reais por categoria (Unsplash, licença livre p/ uso comercial),
// baixadas e recortadas em quadrado em /public/categorias. Cada uma foi
// inspecionada visualmente pra garantir que mostra o tipo certo de peça.
const P = (f: string) => `/categorias/${f}.jpg`;

/**
 * Regras ordenadas — do mais específico pro mais genérico.
 * O `test` roda contra o nome normalizado (maiúsculo, sem acento).
 */
const RULES: CategoryDef[] = [
  { key: 'camara', test: /\bCAMARA(S)?\b/, label: 'Câmara de Ar', icon: 'wheel', photo: P('wheel') },
  { key: 'pneu', test: /\bPNEU(S)?\b/, label: 'Pneu', icon: 'wheel', photo: P('wheel') },
  { key: 'aro', test: /\bARO(S)?\b/, label: 'Aro', icon: 'wheel', photo: P('wheel') },
  { key: 'roda', test: /\bRODA(S)?\b/, label: 'Roda', icon: 'wheel', photo: P('wheel') },
  { key: 'cubo', test: /\bCUBO(S)?\b/, label: 'Cubo', icon: 'wheel', photo: P('wheel') },
  { key: 'raio', test: /\bRAIO(S)?\b/, label: 'Raio', icon: 'wheel', photo: P('wheel') },
  { key: 'niple', test: /\bNIPLE(S)?\b/, label: 'Niple', icon: 'wheel', photo: P('wheel') },
  { key: 'quadro', test: /\bQUADRO(S)?\b/, label: 'Quadro', icon: 'bike', photo: P('frame') },
  { key: 'suspensao', test: /\bSUSP(ENSAO)?\b/, label: 'Suspensão', icon: 'bike', photo: P('fork') },
  { key: 'garfo', test: /\bGARFO(S)?\b/, label: 'Garfo', icon: 'bike', photo: P('fork') },
  { key: 'disco', test: /\b(DISCO|ROTOR)(S)?\b/, label: 'Disco / Rotor', icon: 'brake', photo: P('brake') },
  { key: 'freio', test: /\bFREIO(S)?\b/, label: 'Freio', icon: 'brake', photo: P('brake') },
  { key: 'cassete', test: /\b(CASSETE|CATRACA|CREMALHEIRA)\b/, label: 'Cassete', icon: 'gear', photo: P('drivetrain') },
  { key: 'corrente', test: /\bCORRENTE(S)?\b/, label: 'Corrente', icon: 'gear', photo: P('drivetrain') },
  { key: 'cambio', test: /\bCAMBIO(S)?\b/, label: 'Câmbio', icon: 'gear', photo: P('drivetrain') },
  { key: 'pedivela', test: /\b(PEDIVELA|ENGRENAGEM|COROA|MOVIMENTO)\b/, label: 'Pedivela / Coroa', icon: 'gear', photo: P('drivetrain') },
  { key: 'pedal', test: /\bPEDAL(EIRA)?\b/, label: 'Pedal', icon: 'gear', photo: P('drivetrain') },
  { key: 'movimento', test: /\bMOV\.?\b/, label: 'Movimento Central', icon: 'gear', photo: P('drivetrain') },
  { key: 'selim', test: /\b(SELIM|BANCO)\b/, label: 'Selim', icon: 'cockpit' },
  { key: 'canote', test: /\bCANOTE(S)?\b/, label: 'Canote', icon: 'cockpit' },
  { key: 'manopla', test: /\b(MANOPLA|PUNHO)(S)?\b/, label: 'Manopla', icon: 'cockpit' },
  { key: 'guidao', test: /\b(GUIDAO|MESA|AVANCO|SUP G AHEAD|ESPACADOR)\b/, label: 'Guidão / Mesa', icon: 'cockpit' },
  { key: 'cabo', test: /\b(CABO|CONDUITE|TERMINAL)\b/, label: 'Cabo / Conduíte', icon: 'cable' },
  { key: 'capacete', test: /\bCAPACETE(S)?\b/, label: 'Capacete', icon: 'helmet', photo: P('helmet') },
  { key: 'luva', test: /\bLUVA(S)?\b/, label: 'Luva', icon: 'apparel' },
  { key: 'sapatilha', test: /\b(SAPATILHA|SAPATA)(S)?\b/, label: 'Sapatilha', icon: 'apparel' },
  { key: 'roupa', test: /\b(CAMISA|CAMISETA|BERMUDA|BRETELLE|MEIA|JAQUETA|COLETE|JERSEY)\b/, label: 'Vestuário', icon: 'apparel' },
  { key: 'lube', test: /\b(GRAXA|OLEO|LUBRIF|SELANTE|DESENGRAXANTE|SPRAY)\b/, label: 'Lubrificante', icon: 'lube' },
  { key: 'direcao', test: /\b(JOGO DIR|DIRECAO)\b/, label: 'Direção', icon: 'gear' },
  { key: 'ferramenta', test: /\b(FERRAMENTA|CHAVE|REPARO|EXTRATOR|CORTADOR|DADO|KIT FERRAMENTA)\b/, label: 'Ferramenta', icon: 'tool' },
  { key: 'servico', test: /\b(MAO DE OBRA|SERVICO|INSTALACAO)\b/, label: 'Serviço', icon: 'tool' },
  { key: 'bike', test: /\b(BIKE|BICICLETA|BICI|BIC)(S)?\b/, label: 'Bicicleta', icon: 'bike', photo: P('bike') },
];

const FALLBACK_DEF: CategoryDef = { key: 'outros', test: /.^/, label: 'Acessório', icon: 'box' };

/** Tira acento e deixa maiúsculo pra casar com as regras. */
const normalize = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/**
 * Descobre a categoria de um produto pelo nome.
 * Exportado pra quem quiser o rótulo (ex.: mostrar "Câmara de Ar" no card).
 */
export const categorizeByName = (name: string | null | undefined): CategoryDef => {
  if (!name) return FALLBACK_DEF;
  const n = normalize(name);
  // Nos nomes do Bling a primeira palavra é o tipo ("FREIO ... C/ ROTOR" é um
  // freio; "CABO CAMBIO ..." é um cabo). Então vence a palavra-chave que
  // aparece MAIS CEDO no nome; empate desempata pela ordem das regras.
  let best: CategoryDef | null = null;
  let bestPos = Infinity;
  for (const rule of RULES) {
    const match = n.match(rule.test);
    if (!match) continue;
    const pos = match.index ?? Infinity;
    if (pos < bestPos) {
      best = rule;
      bestPos = pos;
      if (pos === 0) break; // já achou no começo, ninguém vence isso
    }
  }
  return best ?? FALLBACK_DEF;
};

/**
 * Categoria de TOPO (a que vai pro filtro/nav da loja) — sempre uma das quatro
 * oficiais, casando com os slugs das categorias criadas no banco.
 */
export interface TopCategory {
  slug: string;
  label: string;
}

const TOP_BICICLETAS: TopCategory = { slug: 'bicicletas', label: 'Bicicletas' };
const TOP_PECAS: TopCategory = { slug: 'pecas', label: 'Peças' };
const TOP_ACESSORIOS: TopCategory = { slug: 'acessorios', label: 'Acessórios' };
const TOP_SEGURANCA: TopCategory = { slug: 'seguranca', label: 'Equipamentos de Segurança' };

/** Ordem em que as categorias de topo aparecem no filtro/nav. */
export const TOP_CATEGORIES: TopCategory[] = [
  TOP_BICICLETAS,
  TOP_PECAS,
  TOP_ACESSORIOS,
  TOP_SEGURANCA,
];

// Tipo inferido (key de categorizeByName) -> categoria de topo da loja.
const KEY_TO_TOP: Record<string, TopCategory> = {
  bike: TOP_BICICLETAS,
  // Peças (componentes da bike)
  camara: TOP_PECAS,
  pneu: TOP_PECAS,
  aro: TOP_PECAS,
  roda: TOP_PECAS,
  cubo: TOP_PECAS,
  raio: TOP_PECAS,
  niple: TOP_PECAS,
  quadro: TOP_PECAS,
  suspensao: TOP_PECAS,
  garfo: TOP_PECAS,
  disco: TOP_PECAS,
  freio: TOP_PECAS,
  cassete: TOP_PECAS,
  corrente: TOP_PECAS,
  cambio: TOP_PECAS,
  pedivela: TOP_PECAS,
  pedal: TOP_PECAS,
  movimento: TOP_PECAS,
  selim: TOP_PECAS,
  canote: TOP_PECAS,
  manopla: TOP_PECAS,
  guidao: TOP_PECAS,
  cabo: TOP_PECAS,
  direcao: TOP_PECAS,
  // Segurança
  capacete: TOP_SEGURANCA,
  // Acessórios / consumíveis / vestuário / ferramentas / serviço
  luva: TOP_ACESSORIOS,
  sapatilha: TOP_ACESSORIOS,
  roupa: TOP_ACESSORIOS,
  lube: TOP_ACESSORIOS,
  ferramenta: TOP_ACESSORIOS,
  servico: TOP_ACESSORIOS,
};

/**
 * Descobre a categoria de TOPO de um produto pelo nome — categorização
 * automática. Cai em "Acessórios" quando não reconhece o tipo.
 */
export const topCategoryByName = (name: string | null | undefined): TopCategory => {
  const def = categorizeByName(name);
  return KEY_TO_TOP[def.key] ?? TOP_ACESSORIOS;
};

/** Aproxima o tamanho da fonte do rótulo pra caber sempre numa linha. */
const labelFontSize = (label: string): number => {
  const len = label.length;
  if (len <= 9) return 36;
  if (len <= 13) return 31;
  if (len <= 17) return 27;
  return 23;
};

const escapeXml = (s: string): string =>
  s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));

/** Monta o SVG da plaquinha premium de uma categoria. */
const buildTile = (def: CategoryDef): string => {
  const icon = ICONS[def.icon];
  const fs = labelFontSize(def.label);
  const label = escapeXml(def.label);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="${PANEL}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FBE7D4"/>
      <stop offset="1" stop-color="#FBE7D4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="#ffffff"/>
  <rect x="12" y="12" width="376" height="376" rx="26" fill="url(#bg)" stroke="${PANEL_BORDER}" stroke-width="1.5"/>
  <circle cx="200" cy="156" r="92" fill="url(#halo)"/>
  <circle cx="200" cy="156" r="66" fill="#ffffff" stroke="#F3D9C0" stroke-width="1.5"/>
  <g transform="translate(153,109) scale(0.94)" fill="none" stroke="${BRAND}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
  <text x="200" y="296" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="700" fill="${LABEL_COLOR}">${label}</text>
  <rect x="172" y="316" width="56" height="3" rx="1.5" fill="${BRAND}"/>
  <text x="200" y="344" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="1.5" fill="${CAPTION_COLOR}">IMAGEM ILUSTRATIVA</text>
</svg>`;
};

// Cache por categoria — gera o data URI uma vez por tipo, não por produto.
const tileCache = new Map<string, string>();

const tileFor = (def: CategoryDef): string => {
  const cached = tileCache.get(def.key);
  if (cached) return cached;
  const uri = `data:image/svg+xml,${encodeURIComponent(buildTile(def))}`;
  tileCache.set(def.key, uri);
  return uri;
};

/**
 * Imagem de fallback pra um produto, escolhida pelo nome. Categorias visuais
 * (roda, freio, quadro...) ganham uma FOTO real; as abstratas (cabo, selim,
 * ferramenta...) caem na plaquinha SVG da categoria. Use só quando o produto
 * NÃO tem foto própria.
 */
export const fallbackImageFor = (name: string | null | undefined): string => {
  const def = categorizeByName(name);
  return def.photo ?? tileFor(def);
};
