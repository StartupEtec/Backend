import { canonicalPhone } from '../src/utils/phone.js';

describe('canonicalPhone (canonicalización E.164)', () => {
  it('devuelve null para valores vacíos o no-string', () => {
    expect(canonicalPhone(null)).toBeNull();
    expect(canonicalPhone(undefined)).toBeNull();
    expect(canonicalPhone('')).toBeNull();
    expect(canonicalPhone('   ')).toBeNull();
    expect(canonicalPhone('abc-xyz')).toBeNull();
    expect(canonicalPhone(123456)).toBeNull();
  });

  it('agrega el código de país por defecto a números locales', () => {
    expect(canonicalPhone('3001234567')).toBe('+573001234567');
  });

  it('normaliza espacios, guiones y paréntesis', () => {
    expect(canonicalPhone('(300) 123-45-67')).toBe('+573001234567');
  });

  it('conserva un prefijo internacional explícito', () => {
    expect(canonicalPhone('+573001234567')).toBe('+573001234567');
    expect(canonicalPhone('+1 555 123 4567')).toBe('+15551234567');
  });

  it('interpreta "00" como prefijo internacional', () => {
    expect(canonicalPhone('00573001234567')).toBe('+573001234567');
  });

  it('elimina el cero nacional de apertura', () => {
    expect(canonicalPhone('03001234567')).toBe('+573001234567');
  });

  it('no duplica el código de país', () => {
    expect(canonicalPhone('573001234567')).toBe('+573001234567');
  });
});
