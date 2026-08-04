import app from './app.js';
import cache from './utils/cache.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Servidor backend escuchando en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`,
  );
  console.log(`Healthcheck disponible en http://localhost:${PORT}/api/v1/health`);
});

// Conecta la caché (Redis si está configurado, de lo contrario cae a memoria)
cache.connect();

const shutdown = () => {
  console.log('Cerrando servidor HTTP de forma gradual...');
  cache.disconnect();
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
