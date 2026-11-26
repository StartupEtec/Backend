const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PATTERN = /^(tu_|reemplazar|default_|change_me)/i;
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ondemand-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ondemand-client';

const TEST_SECRETS = {
  JWT_SECRET: 'test_only_jwt_secret_0123456789abcdef01234567',
  REFRESH_TOKEN_SECRET: 'test_only_refresh_secret_0123456789abcdef0123',
  JWT_RESET_SECRET: 'test_only_reset_secret_0123456789abcdef01234',
};

function loadSecret(name) {
  const value = process.env[name] || (process.env.NODE_ENV === 'test' ? TEST_SECRETS[name] : null);

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} todavía es un placeholder, generá una clave real`);
  }

  return value;
}

export const JWT_SECRET = loadSecret('JWT_SECRET');
export const REFRESH_TOKEN_SECRET = loadSecret('REFRESH_TOKEN_SECRET');
export const JWT_RESET_SECRET = loadSecret('JWT_RESET_SECRET');
export { JWT_ALGORITHM, JWT_ISSUER, JWT_AUDIENCE };
