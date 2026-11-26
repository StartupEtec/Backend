import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

const buildSslConfig = () => ({
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  ...(process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA, 'utf8') } : {}),
});

const requireProductionDbVar = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
};

/**
  * @type { Object.<string, import("knex").Knex.Config> }
  */
export default {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ondemand_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? buildSslConfig() : false,
    },

    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
  production: {
    client: 'postgresql',
    get connection() {
      return {
        host: requireProductionDbVar('DB_HOST'),
        port: process.env.DB_PORT || 5432,
        database: requireProductionDbVar('DB_NAME'),
        user: requireProductionDbVar('DB_USER'),
        password: requireProductionDbVar('DB_PASSWORD'),
        ssl: buildSslConfig(),
      };
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
};
