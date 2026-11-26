import 'dotenv/config';
import crypto from 'node:crypto';
import knexFactory from 'knex';
import config from '../knexfile.js';
import { encrypt } from '../src/utils/encryption.js';

const BATCH_SIZE = 100;
const legacyKey = process.env.LEGACY_ENCRYPTION_KEY;

function decryptWithLegacyKey(encryptedText) {
  try {
    const key = crypto.createHash('sha256').update(legacyKey).digest();
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

async function reencryptCards() {
  if (!legacyKey) {
    throw new Error('Falta LEGACY_ENCRYPTION_KEY con la clave vieja');
  }

  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const db = knexFactory(config[environment]);

  try {
    await db.transaction(async (trx) => {
      let offset = 0;
      let total = 0;
      const failedIds = [];

      for (;;) {
        const rows = await trx('payment_methods')
          .select('id', 'encrypted_card_number')
          .whereNotNull('encrypted_card_number')
          .orderBy('id')
          .limit(BATCH_SIZE)
          .offset(offset);

        if (rows.length === 0) break;

        for (const row of rows) {
          const plain = decryptWithLegacyKey(row.encrypted_card_number);
          if (!plain) {
            failedIds.push(row.id);
            continue;
          }
          await trx('payment_methods')
            .where({ id: row.id })
            .update({ encrypted_card_number: encrypt(plain) });
          total++;
        }

        offset += rows.length;
      }

      if (failedIds.length > 0) {
        throw new Error(
          `No se pudieron descifrar ${failedIds.length} tarjetas: ${failedIds.join(', ')}`,
        );
      }

      console.log(`OK: ${total} tarjetas re-cifradas con la clave nueva.`);
    });
  } finally {
    await db.destroy();
  }
}

reencryptCards().catch((error) => {
  console.error(`Re-cifrado cancelado: ${error.message}`);
  process.exitCode = 1;
});
