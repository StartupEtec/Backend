import { asyncLocalStorage } from '../utils/logger.js';
import alertService from '../services/AlertService.js';

// Métricas en memoria
export const apmStats = {
  totalRequests: 0,
  statusCodes: {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  },
  recentLatenciesMs: [],
  maxRecentLatencies: 100, // Limitar tamaño de lista en memoria
};

export const apmMiddleware = (req, res, next) => {
  const start = process.hrtime();
  apmStats.totalRequests++;

  // Correr petición dentro del contexto del almacenamiento asíncrono
  asyncLocalStorage.run({ userId: null }, () => {
    res.on('finish', () => {
      const diff = process.hrtime(start);
      const latencyMs = diff[0] * 1e3 + diff[1] * 1e-6;

      // Guardar latencia reciente
      apmStats.recentLatenciesMs.push(latencyMs);
      if (apmStats.recentLatenciesMs.length > apmStats.maxRecentLatencies) {
        apmStats.recentLatenciesMs.shift();
      }

      // Clasificar por código de estado
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        apmStats.statusCodes['2xx']++;
      } else if (statusCode >= 300 && statusCode < 400) {
        apmStats.statusCodes['3xx']++;
      } else if (statusCode >= 400 && statusCode < 500) {
        apmStats.statusCodes['4xx']++;
      } else if (statusCode >= 500) {
        apmStats.statusCodes['5xx']++;

        // Alerta de error 5xx crítico
        alertService.triggerAlert(
          'SERVER_ERROR_SPIKE',
          `Excepción 5xx detectada en la ruta: ${req.method} ${req.originalUrl}`,
          {
            statusCode,
            method: req.method,
            url: req.originalUrl,
          },
        );
      }

      // Alerta por latencia alta
      const threshold = Number(process.env.APM_LATENCY_THRESHOLD_MS || 1000);
      if (latencyMs > threshold) {
        alertService.triggerAlert(
          'HIGH_LATENCY',
          `Latencia alta en endpoint: ${req.method} ${req.originalUrl} (${latencyMs.toFixed(2)}ms)`,
          {
            latencyMs,
            threshold,
            method: req.method,
            url: req.originalUrl,
          },
        );
      }
    });

    next();
  });
};
