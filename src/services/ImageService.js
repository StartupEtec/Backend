import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MESSAGES_DIR = path.join(UPLOAD_DIR, 'messages');
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;

class ImageService {
  /**
   * Valida que el buffer sea una imagen JPEG/PNG válida, la comprime y la
   * almacena en disco. Devuelve la URL pública relativa o un código de error.
   */
  async compressAndStoreImage(buffer) {
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
    const absoluteDir = path.resolve(MESSAGES_DIR);
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

    return { url: `/uploads/messages/${filename}` };
  }

  /**
   * Elimina un archivo almacenado a partir de su URL pública relativa.
   * Se usa para revertir la escritura si la transacción de BD falla.
   */
  async deleteStoredFile(url) {
    if (!url || !url.startsWith('/uploads/messages/')) {
      return false;
    }
    const filename = path.basename(url);
    await fs.promises.unlink(path.join(path.resolve(MESSAGES_DIR), filename));
    return true;
  }
}

export default new ImageService();
