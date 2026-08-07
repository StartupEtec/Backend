import workerSearchService from '../services/WorkerSearchService.js';
import logger from '../utils/logger.js';
import { nearbyWorkersQuerySchema } from '../utils/validation.js';

class WorkerSearchController {
  async nearby(req, res, next) {
    try {
      const { error, value } = nearbyWorkersQuerySchema.validate(req.query);

      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await workerSearchService.findNearby(value);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al buscar trabajadores cercanos:', err);
      next(err);
    }
  }
}

export default new WorkerSearchController();
