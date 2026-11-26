/**
 * Tests de regresión de la canonicalización E.164.
 *
 * Contexto del bug: la implementación anterior usaba heurísticas propias que solo
 * eran correctas para un país, y leía `DEFAULT_PHONE_COUNTRY_CODE` en el ámbito del
 * módulo. Como los imports de ESM se evalúan antes del `dotenv.config()` de
 * src/app.js, el valor del .env nunca se usaba en runtime y siempre ganaba el
 * fallback. Con fallback +57 y datos argentinos:
 *
 *   '011 15-1234-5678' -> '+54111512345678'  (no existe; correcto: +5491112345678)
 *
 * Ahora el parsing lo aporta libphonenumber-js y el env se lee en cada llamada.
 *
 * Estos tests fijan el país explícitamente para ser deterministas: si dependieran
 * del fallback, pasarían en una máquina y fallarían en otra.
 */

const ORIGINAL_ENV = process.env.DEFAULT_PHONE_COUNTRY_CODE;

/** Carga el módulo con un país por defecto concreto. */
async function loadWithCountry(callingCode) {
  process.env.DEFAULT_PHONE_COUNTRY_CODE = callingCode;
  return (await import('../src/utils/phone.js')).canonicalPhone;
}

/** Restaura la variable de entorno, borrándola si no existía. */
function restoreEnv() {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.DEFAULT_PHONE_COUNTRY_CODE;
  } else {
    process.env.DEFAULT_PHONE_COUNTRY_CODE = ORIGINAL_ENV;
  }
}

afterAll(restoreEnv);

describe('canonicalPhone (canonicalización E.164)', () => {
  describe('entradas inválidas', () => {
    it('devuelve null para valores vacíos, no-string o con letras', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone(null)).toBeNull();
      expect(canonicalPhone(undefined)).toBeNull();
      expect(canonicalPhone('')).toBeNull();
      expect(canonicalPhone('   ')).toBeNull();
      expect(canonicalPhone('abc-xyz')).toBeNull();
      expect(canonicalPhone(123456)).toBeNull();
    });

    it('devuelve null para longitudes imposibles', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('123')).toBeNull();
      expect(canonicalPhone('+54911152345678')).toBeNull(); // demasiados dígitos
    });
  });

  describe('Argentina (+54) — el país real de la plataforma', () => {
    it('interpreta el 0 de apertura y el sufijo 15 de los móviles', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      // Este es el caso exacto que reportaba el bug original.
      expect(canonicalPhone('011 15-1234-5678')).toBe('+5491112345678');
    });

    it('resuelve números con el 9 de móvil ya presente', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('9112345678')).toBe('+549112345678');
    });

    it('canonicaliza un fijo sin el 0 de apertura', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('1122334455')).toBe('+541122334455');
    });

    it('respeta el 9 de móvil sin duplicarlo', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('+549112345678')).toBe('+549112345678');
    });

    it('no inventa un móvil a partir de un fragmento incompleto', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      // Sin el 9 ni el 15 no hay forma de saber si es móvil o fijo.
      expect(canonicalPhone('12345678')).toBeNull();
    });
  });

  describe('Colombia (+57) — sigue funcionando si se configura', () => {
    it('agrega el código de país por defecto a números locales', async () => {
      const canonicalPhone = await loadWithCountry('+57');
      expect(canonicalPhone('3001234567')).toBe('+573001234567');
    });

    it('normaliza espacios, guiones y paréntesis', async () => {
      const canonicalPhone = await loadWithCountry('+57');
      expect(canonicalPhone('(300) 123-45-67')).toBe('+573001234567');
    });

    it('elimina el cero nacional de apertura', async () => {
      const canonicalPhone = await loadWithCountry('+57');
      // El 0 es prefijo de línea, no parte del número: no debe quedar en el E.164.
      expect(canonicalPhone('03001234567')).toBe('+573001234567');
    });

    it('no duplica el código de país', async () => {
      const canonicalPhone = await loadWithCountry('+57');
      expect(canonicalPhone('573001234567')).toBe('+573001234567');
    });
  });

  describe('independiente del país por defecto', () => {
    it('conserva un prefijo internacional explícito', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('+573001234567')).toBe('+573001234567');
      expect(canonicalPhone('+1 555 123 4567')).toBe('+15551234567');
    });

    it('interpreta "00" como prefijo internacional', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('00573001234567')).toBe('+573001234567');
    });

    it('normaliza guiones y espacios en formatos internacionales', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      expect(canonicalPhone('+54 9 11 1234-5678')).toBe('+5491112345678');
    });
  });

  describe('el default del código', () => {
    it('cae a Argentina (+54) si DEFAULT_PHONE_COUNTRY_CODE no está definido', async () => {
      delete process.env.DEFAULT_PHONE_COUNTRY_CODE;
      const canonicalPhone = (await import('../src/utils/phone.js')).canonicalPhone;
      expect(canonicalPhone('011 15-1234-5678')).toBe('+5491112345678');
    });

    it('lee el .env aunque el módulo se haya cargado antes que dotenv', async () => {
      // Este test cubre el bug de orden de carga: el import está arriba de este
      // archivo, o sea que phone.js ya se evaluó cuando dotenv todavía no corría.
      const canonicalPhone = await loadWithCountry('+57');
      expect(canonicalPhone('3001234567')).toBe('+573001234567');
    });
  });

  describe('idempotencia y contrato de salida', () => {
    it('canonicalizar un resultado canónico devuelve el mismo valor', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      const unaVez = canonicalPhone('011 15-1234-5678');
      expect(canonicalPhone(unaVez)).toBe(unaVez);
    });

    it('el resultado siempre es E.164 estricto: solo dígitos con un + adelante', async () => {
      const canonicalPhone = await loadWithCountry('+54');
      const entradas = ['011 15-1234-5678', '+54 9 11 1234 5678', '1122334455', '+573001234567'];
      for (const entrada of entradas) {
        const salida = canonicalPhone(entrada);
        if (salida !== null) {
          expect(salida).toMatch(/^\+[1-9][0-9]{7,14}$/);
        }
      }
    });
  });
});
