import app from './app';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`Healthcheck disponible en http://localhost:${PORT}/api/v1/health`);
});

// Manejo de apagado gradual (Graceful Shutdown)
const shutdown = () => {
  console.log('Cerrando servidor HTTP de forma gradual...');
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
