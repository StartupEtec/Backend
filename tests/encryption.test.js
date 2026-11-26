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

  it('debería fallar al descifrar un valor cifrado con otra clave', () => {
    const encryptedWithAnotherKey =
      'b80e6c7cf73d7ff5c0219aadde4e5b78:e9da1c2b7c2eb2bd069d9c0b17470b28';
    expect(decrypt(encryptedWithAnotherKey)).toBeNull();
  });
});
