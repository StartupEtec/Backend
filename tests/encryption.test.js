import { encrypt, decrypt } from '../src/utils/encryption.js';

describe('Encryption utility (AES-256-CBC)', () => {
  it('debería hacer roundtrip encrypt/decrypt', () => {
    const text = '4111111111111111';
    const encrypted = encrypt(text);
    expect(encrypted).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
    expect(decrypt(encrypted)).toBe(text);
  });

  it('debería generar un IV distinto en cada cifrado', () => {
    const a = encrypt('secreto');
    const b = encrypt('secreto');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('secreto');
    expect(decrypt(b)).toBe('secreto');
  });

  it('debería devolver null para entradas vacías', () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt('')).toBeNull();
    expect(decrypt(null)).toBeNull();
    expect(decrypt('')).toBeNull();
  });

  it('debería devolver null para texto cifrado malformado', () => {
    expect(decrypt('sinFormato')).toBeNull();
    expect(decrypt('00:00')).toBeNull();
    expect(decrypt('deadbeef')).toBeNull();
  });

  it('debería fallar al descifrar con una clave distinta', () => {
    process.env.ENCRYPTION_KEY = 'clave-a';
    const encrypted = encrypt('info sensible');
    process.env.ENCRYPTION_KEY = 'clave-b';
    expect(decrypt(encrypted)).toBeNull();
    delete process.env.ENCRYPTION_KEY;
  });
});
