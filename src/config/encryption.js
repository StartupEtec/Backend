const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PATTERN = /^(tu_|reemplazar|default_|change_me)/i;
const TEST_SECRET = 'test_only_encryption_secret_0123456789abcdef01234';

function loadEncryptionKey() {
  const value =
    process.env.ENCRYPTION_KEY || (process.env.NODE_ENV === 'test' ? TEST_SECRET : null);

  if (!value) {
    throw new Error('Falta la variable de entorno obligatoria: ENCRYPTION_KEY');
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`ENCRYPTION_KEY debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error('ENCRYPTION_KEY todavía es un placeholder, generá una clave real');
  }

  return value;
}

export const ENCRYPTION_KEY = loadEncryptionKey();
