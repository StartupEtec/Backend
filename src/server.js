import app from './app.js';
import cache from './utils/cache.js';
import websocketHub from './utils/websocket.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Servidor backend escuchando en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`,
  );
  console.log(`Healthcheck disponible en http://localhost:${PORT}/api/v1/health`);
});

// Conecta el hub de WebSocket al servidor HTTP (auth por token en el handshake)
websocketHub.attach(server);

// Conecta la caché (Redis si está configurado, de lo contrario cae a memoria)
cache.connect();

const shutdown = () => {
  console.log('Cerrando servidor HTTP de forma gradual...');
  cache.disconnect();
  websocketHub.close();
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
