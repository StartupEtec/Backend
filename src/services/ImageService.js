import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const FOLDERS = {
  messages: path.join(UPLOAD_DIR, 'messages'),
  profiles: path.join(UPLOAD_DIR, 'profiles'),
};
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;

class ImageService {
  /**
   * Valida que el buffer sea una imagen JPEG/PNG válida, la comprime y la
   * almacena en disco. Devuelve la URL pública relativa o un código de error.
   *
   * @param {Buffer} buffer
   * @param {{ folder?: 'messages' | 'profiles' }} [options]
   * @returns {Promise<{ url: string } | { error: 'INVALID_IMAGE' | 'INVALID_IMAGE_TYPE' }>}
   */
  async compressAndStoreImage(buffer, { folder = 'messages' } = {}) {
    const targetDir = FOLDERS[folder] || FOLDERS.messages;

    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      return { error: 'INVALID_IMAGE' };
    }

    if (metadata.format !== 'jpeg' && metadata.format !== 'png') {
      return { error: 'INVALID_IMAGE_TYPE' };
    }

    const filename = `${randomUUID()}.jpg`;
    const absoluteDir = path.resolve(targetDir);
    await fs.promises.mkdir(absoluteDir, { recursive: true });

    await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(path.join(absoluteDir, filename));

    return { url: `/uploads/${folder}/${filename}` };
  }

  /**
   * Elimina un archivo almacenado a partir de su URL pública relativa.
   * Se usa para revertir la escritura si la transacción de BD falla. Solo toca
   * las carpetas que administra este servicio: una URL externa (por ejemplo un
   * CDN) nunca se borra del disco.
   */
  async deleteStoredFile(url) {
    const folder = Object.keys(FOLDERS).find((name) => url?.startsWith(`/uploads/${name}/`));
    if (!folder) return false;

    const filename = path.basename(url);
    await fs.promises.unlink(path.join(path.resolve(FOLDERS[folder]), filename));
    return true;
  }
}

export default new ImageService();
