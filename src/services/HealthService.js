import db from '../database/db.js';
import cache from '../utils/cache.js';
import alertService from './AlertService.js';
import { apmStats } from '../middlewares/apm.js';

class HealthService {
  /**
   * Ejecuta un chequeo básico y rápido de salud.
   * Retorna un resumen rápido: API, base de datos y caché.
   */
  async getBasicHealth() {
    const dbStatus = await this._checkDatabase();
    const cacheStatus = await this._checkCache();

    const isHealthy = dbStatus.status === 'UP' && cacheStatus.status === 'UP';

    return {
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services: {
        api: 'UP',
        database: dbStatus.status,
        cache: cacheStatus.status,
      },
    };
  }

  /**
   * Ejecuta un chequeo profundo y detallado de salud, incluyendo
   * latencias de red, estadísticas de APM e información del entorno.
   */
  async getDetailedHealth() {
    const start = process.hrtime();

    const [dbResult, cacheResult] = await Promise.all([this._checkDatabase(), this._checkCache()]);

    const apmSummary = this._getApmSummary();
    const diff = process.hrtime(start);
    const apiLatencyMs = diff[0] * 1e3 + diff[1] * 1e-6;

    const overallStatus =
      dbResult.status === 'UP' && cacheResult.status === 'UP' ? 'UP' : 'DEGRADED';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(), // Segundos de vida de la app
      components: {
        api: {
          status: 'UP',
          latency_ms: apiLatencyMs,
        },
        database: dbResult,
        cache: cacheResult,
      },
      apm: apmSummary,
    };
  }

  async _checkDatabase() {
    const start = process.hrtime();
    try {
      // Query rápida de verificación
      await db.raw('SELECT 1');
      const diff = process.hrtime(start);
      return {
        status: 'UP',
        latency_ms: diff[0] * 1e3 + diff[1] * 1e-6,
      };
    } catch (err) {
      alertService.triggerAlert(
        'DATABASE_DOWN',
        `Fallo de conexión a base de datos: ${err.message}`,
        {
          error: err.stack,
        },
      );
      return {
        status: 'DOWN',
        error: err.message,
      };
    }
  }

  async _checkCache() {
    const start = process.hrtime();
    try {
      if (cache.useRedis && cache.client) {
        // Ping de Redis
        await cache.client.ping();
        const diff = process.hrtime(start);
        return {
          status: 'UP',
          type: 'redis',
          latency_ms: diff[0] * 1e3 + diff[1] * 1e-6,
        };
      } else {
        // Degradado a memoria local
        return {
          status: 'UP',
          type: 'memory',
          message: 'Redis no configurado o inalcanzable. Degradado a caché en memoria.',
        };
      }
    } catch (err) {
      alertService.triggerAlert('REDIS_DOWN', `Fallo al verificar servidor Redis: ${err.message}`, {
        error: err.stack,
      });
      return {
        status: 'DOWN',
        error: err.message,
      };
    }
  }

  _getApmSummary() {
    const latencies = apmStats.recentLatenciesMs;
    const avgLatency = latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    // Calcular el percentil 95
    let p95Latency = 0;
    if (latencies.length) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * 0.95);
      p95Latency = sorted[idx];
    }

    const total = apmStats.totalRequests;
    const error5xx = apmStats.statusCodes['5xx'];
    const errorRate = total ? (error5xx / total) * 100 : 0;

    return {
      total_requests: total,
      error_rates: apmStats.statusCodes,
      error_rate_5xx_percentage: Number(errorRate.toFixed(2)),
      latency_stats: {
        avg_ms: Number(avgLatency.toFixed(2)),
        p95_ms: Number(p95Latency.toFixed(2)),
      },
    };
  }
}

export default new HealthService();
