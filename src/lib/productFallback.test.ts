import { describe, it, expect } from 'vitest';
import { categorizeByName, fallbackImageFor } from './productFallback';

describe('categorizeByName', () => {
  const cases: Array<[string, string]> = [
    ['CAMARA 700X23/32C BUTILICA 48MM PRESTA', 'Câmara de Ar'],
    ['PNEU 29 X 2.10 SRI 68 BEYOND PT', 'Pneu'],
    ['ARO 29 X 32F ALUM MTB ACE PRETO/CINZA', 'Aro'],
    ['QUADRO 26 ALM DJ TUFF X-44 PTO/BCO', 'Quadro'],
    ['SUSPENSAO 26 AL/AL 28.6 150MM PTO', 'Suspensão'],
    ['GARFO 26 CR-MO 28.6 AHEADSET', 'Garfo'],
    ['FREIO DISC HIDR ALU D+T C/ ROTOR ROXO', 'Freio'],
    ['DISCO FREIO DIANT/TRAS 160MM. XT-03 ( PAR )', 'Disco / Rotor'],
    ['CAMBIO SHIMANO DEORE', 'Câmbio'],
    ['CORRENTE KMC X11', 'Corrente'],
    ['CASSETE 9V (11-36D), CROM, CS-9S, OEM', 'Cassete'],
    ['RAIO PRETO 2.0 X 255 GROSA', 'Raio'],
    ['CUBO DIANT/ TRAS ACO 32H PT', 'Cubo'],
    ['MANOPLA MTB MOD 2 PT', 'Manopla'],
    ['SAPATILHA ROAD SH-RC102 TAM 45 BCO', 'Sapatilha'],
    ['CAMISA CASUAL T-DRY MOD. 03 CZ CHUMBO', 'Vestuário'],
    ['GRAXA SLICKGEASE BY SLICKOLEUM 500G', 'Lubrificante'],
    ['SELANTE P/ PROTECAO ANTI-FURO, 500ML', 'Lubrificante'],
    ['CHAVE TRIANGULO', 'Ferramenta'],
    ['KIT FERRAMENTA DE REMOCAO DO GANCHO PISTAO ZTTO', 'Ferramenta'],
    ['MÃO DE OBRA', 'Serviço'],
    ['JOGO DIR 22.2 8 PCS C/ TRAVA PRETO', 'Direção'],
    ['CABO CAMBIO TRAS. MTB 1.2X2.000MM', 'Cabo / Conduíte'],
    ['CONDUITE C/TEFLON ROLO 20MT PTO', 'Cabo / Conduíte'],
    ['CAPACETE AERODINAMICO PRO', 'Capacete'],
    ['LUVAS GEL PREMIUM', 'Luva'],
    ['CESTINHA', 'Acessório'],
    ['BIC OGGI 29 BW 7.0 CUES 9V VD/LAR 17 2026', 'Bicicleta'],
    ['BICICLETA OGGI 29 BW 7.0', 'Bicicleta'],
    ['BICO TUBLLES', 'Acessório'],
  ];

  it.each(cases)('classifica %s', (name, expected) => {
    expect(categorizeByName(name).label).toBe(expected);
  });

  it('cai em Acessório quando não reconhece', () => {
    expect(categorizeByName('XYZ ITEM DESCONHECIDO 123').label).toBe('Acessório');
  });

  it('lida com nome vazio/nulo', () => {
    expect(categorizeByName('').label).toBe('Acessório');
    expect(categorizeByName(undefined).label).toBe('Acessório');
  });
});

describe('fallbackImageFor', () => {
  it('usa foto real nas categorias visuais', () => {
    expect(fallbackImageFor('QUADRO 26 ALM DJ TUFF')).toBe('/categorias/frame.jpg');
    expect(fallbackImageFor('RAIO PRETO 286')).toBe('/categorias/wheel.jpg');
    expect(fallbackImageFor('CAMARA 700X23')).toBe('/categorias/wheel.jpg');
    expect(fallbackImageFor('FREIO DISC HIDR')).toBe('/categorias/brake.jpg');
    expect(fallbackImageFor('CAMBIO SHIMANO')).toBe('/categorias/drivetrain.jpg');
    expect(fallbackImageFor('CAPACETE PRO')).toBe('/categorias/helmet.jpg');
  });

  it('gera plaquinha SVG nas categorias abstratas (sem foto)', () => {
    const uri = fallbackImageFor('CABO CAMBIO TRAS');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(uri.replace('data:image/svg+xml,', ''));
    expect(svg).toContain('<svg');
    expect(svg).toContain('Cabo');
  });

  it('item desconhecido cai na plaquinha de Acessório', () => {
    const uri = fallbackImageFor('XYZ DESCONHECIDO');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
  });
});
