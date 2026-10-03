import { jest } from '@jest/globals';
import { up, down } from '../src/database/migrations/20261001000001_recanonicalize_phones_e164.js';

/**
 * Tests de la migración `20261001000001_recanonicalize_phones_e164`.
 *
 * Esta migración escribe sobre `users.phone` en producción, así que necesita estar
 * cubierta: si canonicaliza mal, deja usuarios sin poder loguearse por teléfono
 * (`users_phone_unique` es UNIQUE y el login busca por teléfono).
 *
 * Se ejercita contra un knex falso en memoria, nunca contra la base real.
 *
 * El caso que más importa es 'no toca lo que no puede confirmar': la migración
 * anterior hacía un UPDATE a ciegas que convertía '5491144441111' en
 * '+575491144441111'. Acá los números que libphonenumber no reconoce como asignados
 * se reportan pero no se reescriben.
 */

const ORIGINAL_PHONE_COUNTRY = process.env.DEFAULT_PHONE_COUNTRY_CODE;

/**
 * knex mínimo con las operaciones que usa la migración:
 *   knex('users').select(...).whereNotNull('phone')
 *   knex('users').select(...).whereIn('phone', [...])
 *   knex('users').where({ id }).update({ phone })
 * Los builders son thenables, igual que los de knex.
 */
function createFakeKnex(rows) {
  const users = rows;

  const knex = () => {
    let where = null;
    let whereInValues = null;
    let pendingUpdate = null;

    const matches = (row) => {
      if (where) return Object.entries(where).every(([k, v]) => row[k] === v);
      if (whereInValues) return whereInValues.includes(row.phone);
      return true;
    };

    const builder = {
      select() {
        return builder;
      },
      whereNotNull() {
        return builder;
      },
      whereIn(_col, values) {
        whereInValues = values;
        return builder;
      },
      where(clause) {
        where = clause;
        return builder;
      },
      update(values) {
        pendingUpdate = values;
        return builder;
      },
      then(resolve) {
        if (pendingUpdate) {
          const target = users.find((u) => u.id === where.id);
          if (target) Object.assign(target, pendingUpdate);
          return resolve(1);
        }
        return resolve(
          users
            .filter((u) => u.phone != null)
            .map((u) => ({ id: u.id, phone: u.phone }))
            .filter(matches),
        );
      },
    };

    return builder;
  };

  knex.__users = users;
  return knex;
}

let warnSpy;

beforeEach(() => {
  process.env.DEFAULT_PHONE_COUNTRY_CODE = '+54';
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

afterAll(() => {
  if (ORIGINAL_PHONE_COUNTRY === undefined) {
    delete process.env.DEFAULT_PHONE_COUNTRY_CODE;
  } else {
    process.env.DEFAULT_PHONE_COUNTRY_CODE = ORIGINAL_PHONE_COUNTRY;
  }
});

const warnings = () => warnSpy.mock.calls.flat().join('\n');

describe('migración 20261001000001 — recanonicalización E.164 de users.phone', () => {
  it('repara los móviles argentinos que la heurística vieja guardó mal', async () => {
    // Este es el bug concreto: '011 15-1234-5678' se guardaba como
    // '+54111512345678' (no existe) en vez de '+5491112345678'.
    const knex = createFakeKnex([
      { id: 1, phone: '+54111512345678' },
      { id: 2, phone: '011 15-9876-5432' },
    ]);

    await up(knex);

    expect(knex.__users[0].phone).toBe('+5491112345678');
    expect(knex.__users[1].phone).toBe('+5491198765432');
  });

  it('repara números sin el "+" usando el país configurado, sin prefixar de más', async () => {
    // El UPDATE a ciegas de la migración anterior producía '+575491144441111'
    // para este mismo valor. Acá se resuelve con el parsing real.
    const knex = createFakeKnex([
      { id: 1, phone: '5491144441111' },
      { id: 2, phone: '91123456789' },
    ]);

    await up(knex);

    expect(knex.__users[0].phone).toBe('+5491144441111');
    expect(knex.__users[1].phone).toBe('+5491123456789');
  });

  it('respeta DEFAULT_PHONE_COUNTRY_CODE para números locales', async () => {
    process.env.DEFAULT_PHONE_COUNTRY_CODE = '+57';
    const knex = createFakeKnex([{ id: 1, phone: '3001234567' }]);

    await up(knex);

    expect(knex.__users[0].phone).toBe('+573001234567');
  });

  it('es idempotente: correrla dos veces no cambia nada', async () => {
    const knex = createFakeKnex([
      { id: 1, phone: '+54111512345678' }, // roto, se repara
      { id: 2, phone: '+5491111111111' }, // ya canónico
      { id: 3, phone: '+541122334455' }, // fijo, ya canónico
    ]);

    await up(knex);
    const despues = knex.__users.map((u) => u.phone);
    await up(knex);

    expect(knex.__users.map((u) => u.phone)).toEqual(despues);
    expect(despues).toEqual(['+5491112345678', '+5491111111111', '+541122334455']);
  });

  it('no toca los teléfonos que ya están canónicos', async () => {
    const knex = createFakeKnex([{ id: 1, phone: '+5491112345678' }]);

    await up(knex);

    expect(knex.__users[0].phone).toBe('+5491112345678');
    expect(warnings()).toContain('reparados=0');
  });

  describe('no toca lo que no puede confirmar', () => {
    it('reporta los números que solo son "posibles" y los deja como están', async () => {
      // '9112345678' tiene la forma de un móvil argentino pero le falta un dígito:
      // libphonenumber lo marca posible y NO válido. No se puede atribuir con
      // certeza, y reescribirlo a ciegas es lo que rompió los datos antes.
      const knex = createFakeKnex([{ id: 1, phone: '9112345678' }]);

      await up(knex);

      expect(knex.__users[0].phone).toBe('9112345678');
      expect(warnings()).toContain('para revisión manual=1');
    });

    it('deja intactos los no parseables y los reporta', async () => {
      const knex = createFakeKnex([
        { id: 1, phone: 'no-es-un-telefono' },
        { id: 2, phone: '+54111512345678' },
      ]);

      await up(knex);

      // El inválido no se pisa con null, y el válido sí se repara en la misma corrida.
      expect(knex.__users[0].phone).toBe('no-es-un-telefono');
      expect(knex.__users[1].phone).toBe('+5491112345678');
      expect(warnings()).toContain('no parseables=1');
    });
  });

  describe('colisiones con users_phone_unique', () => {
    it('falla antes de escribir si dos filas del lote colisionan', async () => {
      // Mismo móvil, dos formatos distintos: ambos canonicalizan a +5491112345678.
      const knex = createFakeKnex([
        { id: 1, phone: '011 15-1234-5678' },
        { id: 2, phone: '+54 9 11 1234-5678' },
      ]);

      await expect(up(knex)).rejects.toThrow(/colisión/);

      expect(knex.__users[0].phone).toBe('011 15-1234-5678');
      expect(knex.__users[1].phone).toBe('+54 9 11 1234-5678');
    });

    it('falla si el destino ya lo ocupa una fila que no se está moviendo', async () => {
      const knex = createFakeKnex([
        { id: 1, phone: '+54111512345678' }, // se canoniza a +5491112345678
        { id: 2, phone: '+5491112345678' }, // ya lo ocupa
      ]);

      await expect(up(knex)).rejects.toThrow(/colisión/);
      expect(knex.__users[0].phone).toBe('+54111512345678');
    });
  });

  it('no rompe con la tabla vacía', async () => {
    const knex = createFakeKnex([]);
    await expect(up(knex)).resolves.toBeUndefined();
  });

  it('down() es no-op: la forma original no es recuperable', async () => {
    const knex = createFakeKnex([{ id: 1, phone: 'no-es-un-telefono' }]);
    await expect(down(knex)).resolves.toBeUndefined();
    expect(knex.__users[0].phone).toBe('no-es-un-telefono');
  });
});
