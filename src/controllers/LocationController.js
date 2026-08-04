import locationService from '../services/LocationService.js';
import logger from '../utils/logger.js';
import {
  createLocationSchema,
  updateLocationSchema,
  listLocationsQuerySchema,
} from '../utils/validation.js';

class LocationController {
  async create(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para crear ubicaciones de otro usuario',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = createLocationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await locationService.createLocation(id, value);

      if (result.error === 'LOCATION_LIMIT_REACHED') {
        return res.status(409).json({
          error: 'LOCATION_LIMIT_REACHED',
          message: 'Máximo de 10 ubicaciones por usuario alcanzado',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        message: 'Ubicación creada correctamente',
        location: result,
      });
    } catch (err) {
      logger.error('Error al crear ubicación:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para acceder a las ubicaciones de otro usuario',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { lat, lng } = req.query;
      if (lat !== undefined || lng !== undefined) {
        const { error } = listLocationsQuerySchema.validate({ lat, lng });
        if (error) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: error.details[0].message,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const locations = await locationService.listLocations(
        id,
        lat !== undefined ? Number(lat) : null,
        lng !== undefined ? Number(lng) : null,
      );

      return res.status(200).json({
        locations,
        count: locations.length,
      });
    } catch (err) {
      logger.error('Error al listar ubicaciones:', err);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { location_id } = req.params;

      const location = await locationService.getLocationById(location_id);

      if (!location || location.user_id !== req.user.user_id) {
        return res.status(404).json({
          error: 'LOCATION_NOT_FOUND',
          message: 'Ubicación no encontrada',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(location);
    } catch (err) {
      logger.error('Error al obtener ubicación:', err);
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { location_id } = req.params;

      const { error, value } = updateLocationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const location = await locationService.updateLocation(location_id, req.user.user_id, value);

      if (!location) {
        return res.status(404).json({
          error: 'LOCATION_NOT_FOUND',
          message: 'Ubicación no encontrada o no tienes permiso para modificarla',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: 'Ubicación actualizada correctamente',
        location,
      });
    } catch (err) {
      logger.error('Error al actualizar ubicación:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { location_id } = req.params;

      const deleted = await locationService.deleteLocation(location_id, req.user.user_id);

      if (!deleted) {
        return res.status(404).json({
          error: 'LOCATION_NOT_FOUND',
          message: 'Ubicación no encontrada o no tienes permiso para eliminarla',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: 'Ubicación eliminada correctamente',
      });
    } catch (err) {
      logger.error('Error al eliminar ubicación:', err);
      next(err);
    }
  }
}

export default new LocationController();
