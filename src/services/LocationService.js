import db from '../database/db.js';
import logger from '../utils/logger.js';

const MAX_LOCATIONS_PER_USER = 10;

class LocationService {
  /**
   * Convierte una fila de la tabla `locations` a la representación de la API.
   * `latitude`/`longitude`/`distance_m` llegan como cadenas desde pg.
   */
  formatRow(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      address: row.address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      is_primary: row.is_primary,
      distance_m: row.distance_m != null ? Number(row.distance_m) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async countByUser(userId) {
    const [{ total }] = await db('locations').where({ user_id: userId }).count('* as total');
    return Number(total);
  }

  async createLocation(userId, data) {
    const total = await this.countByUser(userId);

    if (total >= MAX_LOCATIONS_PER_USER) {
      return { error: 'LOCATION_LIMIT_REACHED' };
    }

    const isPrimary = data.is_primary === true || total === 0;

    if (isPrimary) {
      await db('locations').where({ user_id: userId }).update({ is_primary: false });
    }

    const [row] = await db('locations')
      .insert({
        user_id: userId,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        is_primary: isPrimary,
        geography: db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [
          data.longitude,
          data.latitude,
        ]),
      })
      .returning([
        'id',
        'user_id',
        'address',
        'latitude',
        'longitude',
        'is_primary',
        'created_at',
        'updated_at',
      ]);

    logger.info('[AUDITORIA] Ubicación creada', {
      user_id: userId,
      location_id: row.id,
      is_primary: isPrimary,
      timestamp: new Date().toISOString(),
    });

    return this.formatRow(row);
  }

  async listLocations(userId, referenceLat, referenceLng) {
    let query = db('locations').where({ user_id: userId });

    if (referenceLat != null && referenceLng != null) {
      query = query.select(
        '*',
        db.raw(
          'ST_Distance(geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) as distance_m',
          [referenceLng, referenceLat],
        ),
      );
    } else {
      query = query.select('*');
    }

    const rows = await query.orderBy('created_at', 'asc');
    return rows.map((row) => this.formatRow(row));
  }

  async getLocationById(locationId) {
    const row = await db('locations').where({ id: locationId }).first();
    return row ? this.formatRow(row) : null;
  }

  async updateLocation(locationId, userId, data) {
    const existing = await db('locations').where({ id: locationId, user_id: userId }).first();

    if (!existing) return null;

    const updates = {};
    if (data.address !== undefined) updates.address = data.address;
    if (data.latitude !== undefined) updates.latitude = data.latitude;
    if (data.longitude !== undefined) updates.longitude = data.longitude;

    if (data.latitude !== undefined || data.longitude !== undefined) {
      const lat = data.latitude ?? existing.latitude;
      const lng = data.longitude ?? existing.longitude;
      updates.geography = db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [lng, lat]);
    }

    if (data.is_primary === true) {
      await db('locations').where({ user_id: userId }).update({ is_primary: false });
      updates.is_primary = true;
    } else if (data.is_primary === false) {
      updates.is_primary = false;
    }

    updates.updated_at = db.fn.now();

    await db('locations').where({ id: locationId, user_id: userId }).update(updates);

    const row = await db('locations').where({ id: locationId, user_id: userId }).first();

    logger.info('[AUDITORIA] Ubicación actualizada', {
      user_id: userId,
      location_id: locationId,
      changes: Object.keys(updates).filter((key) => key !== 'updated_at'),
      timestamp: new Date().toISOString(),
    });

    return this.formatRow(row);
  }

  async deleteLocation(locationId, userId) {
    const deleted = await db('locations').where({ id: locationId, user_id: userId }).del();

    if (deleted > 0) {
      logger.info('[AUDITORIA] Ubicación eliminada', {
        user_id: userId,
        location_id: locationId,
        timestamp: new Date().toISOString(),
      });
    }

    return deleted > 0;
  }
}

export default new LocationService();
