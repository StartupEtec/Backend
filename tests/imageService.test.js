import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

// Se aísla el directorio de uploads para no dejar artefactos en el repo.
const tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-test-'));
process.env.UPLOAD_DIR = tmpUploadDir;

const { default: imageService } = await import('../src/services/ImageService.js');

const buildImage = (format, { width = 40, height = 40 } = {}) =>
  sharp({ create: { width, height, channels: 3, background: '#ff0000' } })
    [format]()
    .toBuffer();

describe('ImageService.compressAndStoreImage', () => {
  afterAll(() => {
    fs.rmSync(tmpUploadDir, { recursive: true, force: true });
  });

  it('should return a .jpg URL under /uploads/profiles for profile images', async () => {
    const png = await buildImage('png');

    const result = await imageService.compressAndStoreImage(png, { folder: 'profiles' });

    // La URL tiene que cumplir el patrón de validación de los perfiles (.jpg).
    expect(result.url).toMatch(/^\/uploads\/profiles\/[0-9a-f-]+\.jpg$/);

    const storedPath = path.join(tmpUploadDir, 'profiles', path.basename(result.url));
    expect(fs.existsSync(storedPath)).toBe(true);
  });

  it('should default to the messages folder', async () => {
    const jpeg = await buildImage('jpeg');

    const result = await imageService.compressAndStoreImage(jpeg);

    expect(result.url).toMatch(/^\/uploads\/messages\/[0-9a-f-]+\.jpg$/);
  });

  it('should delete a stored profile image', async () => {
    const jpeg = await buildImage('jpeg');

    const { url } = await imageService.compressAndStoreImage(jpeg, { folder: 'profiles' });
    const storedPath = path.join(tmpUploadDir, 'profiles', path.basename(url));
    expect(fs.existsSync(storedPath)).toBe(true);

    await expect(imageService.deleteStoredFile(url)).resolves.toBe(true);
    expect(fs.existsSync(storedPath)).toBe(false);
  });

  it('should refuse to delete URLs outside the managed folders', async () => {
    await expect(imageService.deleteStoredFile('https://cdn.example.com/a.jpg')).resolves.toBe(
      false,
    );
    await expect(imageService.deleteStoredFile('/uploads/other/a.jpg')).resolves.toBe(false);
    await expect(imageService.deleteStoredFile(null)).resolves.toBe(false);
  });

  it('should reject a buffer that is not an image', async () => {
    const result = await imageService.compressAndStoreImage(Buffer.from('definitely not an image'));

    expect(result).toEqual({ error: 'INVALID_IMAGE' });
  });

  it('should reject valid images in formats other than JPG/PNG', async () => {
    const webp = await buildImage('webp');

    const result = await imageService.compressAndStoreImage(webp, { folder: 'profiles' });

    expect(result).toEqual({ error: 'INVALID_IMAGE_TYPE' });
  });

  it('should recompress the image instead of storing the original bytes', async () => {
    const jpeg = await buildImage('jpeg', { width: 3000, height: 3000 });

    const result = await imageService.compressAndStoreImage(jpeg, { folder: 'profiles' });

    const storedPath = path.join(tmpUploadDir, 'profiles', path.basename(result.url));
    const metadata = await sharp(storedPath).metadata();
    // sharp limita el lado mayor a 1600px sin agrandar.
    expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(1600);
  });
});
