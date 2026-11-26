import { toPublicUrl } from '../src/utils/publicUrl.js';

describe('toPublicUrl', () => {
  const originalBase = process.env.PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalBase;
  });

  test('devuelve la ruta relativa si no hay base configurada', () => {
    delete process.env.PUBLIC_BASE_URL;

    expect(toPublicUrl('/uploads/messages/a.jpg')).toBe('/uploads/messages/a.jpg');
    expect(toPublicUrl(null)).toBeNull();
    expect(toPublicUrl(undefined)).toBeNull();
  });

  test('resuelve rutas relativas con la base pública', () => {
    process.env.PUBLIC_BASE_URL = 'https://api.example.com/';

    expect(toPublicUrl('/uploads/messages/a.jpg')).toBe(
      'https://api.example.com/uploads/messages/a.jpg',
    );
    expect(toPublicUrl('uploads/profiles/a.jpg')).toBe(
      'https://api.example.com/uploads/profiles/a.jpg',
    );
  });

  test('no modifica URLs ya absolutas', () => {
    process.env.PUBLIC_BASE_URL = 'https://api.example.com';

    expect(toPublicUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(toPublicUrl('//cdn.example.com/a.jpg')).toBe('//cdn.example.com/a.jpg');
    expect(toPublicUrl('data:image/jpeg;base64,abc')).toBe('data:image/jpeg;base64,abc');
  });
});
