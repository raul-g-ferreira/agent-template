import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const out = (caso: string) => JSON.parse(readFileSync(`out/${caso}.json`, 'utf8'));

describe('casos exemplo', () => {
  it('exemplo-1 (simples)', () => {
    expect(out('exemplo-1')).toEqual({
      ana: { multa_centavos: 450, bloqueado: false },
      bruno: { multa_centavos: 0, bloqueado: false },
      carla: { multa_centavos: 0, bloqueado: false },
    });
  });

  it('exemplo-2 (médio: feriado, reserva, teto, não devolvido)', () => {
    expect(out('exemplo-2')).toEqual({
      davi: { multa_centavos: 750, bloqueado: false },
      eva: { multa_centavos: 3000, bloqueado: true },
      fabio: { multa_centavos: 0, bloqueado: false },
      gabi: { multa_centavos: 0, bloqueado: false },
    });
  });
});
