import db from '../database/db.js';
import logger from '../utils/logger.js';

const MAX_RANGES_PER_DAY = 2;

class WorkerAvailabilityService {
  /**
   * Devuelve el perfil de trabajador solo si pertenece al usuario autenticado.
   */
  getOwnedWorker(workerId, userId) {
    return db('worker_profiles').where({ id: workerId, user_id: userId }).first();
  }

  /**
   * pg devuelve TIME como 'HH:MM:SS'; la API expone 'HH:MM'.
   */
  formatTime(value) {
    return typeof value === 'string' && value.length > 5 ? value.slice(0, 5) : value;
  }

  formatRow(row) {
    return {
      id: row.id,
      worker_id: row.worker_id,
      day_of_week: Number(row.day_of_week),
      start_time: this.formatTime(row.start_time),
      end_time: this.formatTime(row.end_time),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  countByDay(workerId, dayOfWeek, excludeId = null) {
    let query = db('worker_availability').where({ worker_id: workerId, day_of_week: dayOfWeek });
    if (excludeId) {
      query = query.whereNot({ id: excludeId });
    }
    return query.count('* as total');
  }

  async createAvailability(workerId, userId, data) {
    const worker = await this.getOwnedWorker(workerId, userId);
    if (!worker) {
      return {
        error: 'WORKER_PROFILE_NOT_FOUND',
        message: 'Perfil de trabajador no encontrado o no tienes permiso',
      };
    }

    const [{ total }] = await this.countByDay(workerId, data.day_of_week);
    if (Number(total) >= MAX_RANGES_PER_DAY) {
      return {
        error: 'DAILY_LIMIT_REACHED',
        message: `Máximo de ${MAX_RANGES_PER_DAY} rangos de disponibilidad por día`,
      };
    }

    const [row] = await db('worker_availability')
      .insert({
        worker_id: workerId,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
      })
      .returning('*');

    logger.info('[AUDITORIA] Disponibilidad creada', {
      worker_id: workerId,
      availability_id: row.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      timestamp: new Date().toISOString(),
    });

    return this.formatRow(row);
  }

  async listAvailability(workerId, userId) {
    const worker = await this.getOwnedWorker(workerId, userId);
    if (!worker) {
      return {
        error: 'WORKER_PROFILE_NOT_FOUND',
        message: 'Perfil de trabajador no encontrado o no tienes permiso',
      };
    }

    const rows = await db('worker_availability')
      .where({ worker_id: workerId })
      .orderBy([{ column: 'day_of_week' }, { column: 'start_time' }]);

    return rows.map((row) => this.formatRow(row));
  }

  async updateAvailability(availabilityId, userId, data) {
    const availability = await db('worker_availability').where({ id: availabilityId }).first();
    if (!availability) {
      return { error: 'AVAILABILITY_NOT_FOUND', message: 'Disponibilidad no encontrada' };
    }

    const worker = await this.getOwnedWorker(availability.worker_id, userId);
    if (!worker) {
      return {
        error: 'AVAILABILITY_NOT_FOUND',
        message: 'Disponibilidad no encontrada o no tienes permiso',
      };
    }

    const nextDay = data.day_of_week ?? Number(availability.day_of_week);
    const nextStart = data.start_time ?? this.formatTime(availability.start_time);
    const nextEnd = data.end_time ?? this.formatTime(availability.end_time);

    if (nextStart >= nextEnd) {
      return {
        error: 'INVALID_TIME_RANGE',
        message: 'start_time debe ser anterior a end_time',
      };
    }

    if (data.day_of_week !== undefined && data.day_of_week !== Number(availability.day_of_week)) {
      const [{ total }] = await this.countByDay(
        availability.worker_id,
        data.day_of_week,
        availabilityId,
      );
      if (Number(total) >= MAX_RANGES_PER_DAY) {
        return {
          error: 'DAILY_LIMIT_REACHED',
          message: `Máximo de ${MAX_RANGES_PER_DAY} rangos de disponibilidad por día`,
        };
      }
    }

    const updates = {};
    if (data.day_of_week !== undefined) updates.day_of_week = data.day_of_week;
    if (data.start_time !== undefined) updates.start_time = data.start_time;
    if (data.end_time !== undefined) updates.end_time = data.end_time;
    updates.updated_at = db.fn.now();

    await db('worker_availability').where({ id: availabilityId }).update(updates);

    const row = await db('worker_availability').where({ id: availabilityId }).first();

    logger.info('[AUDITORIA] Disponibilidad actualizada', {
      worker_id: availability.worker_id,
      availability_id: availabilityId,
      changes: Object.keys(updates).filter((key) => key !== 'updated_at'),
      timestamp: new Date().toISOString(),
    });

    return this.formatRow(row);
  }

  async deleteAvailability(availabilityId, userId) {
    const availability = await db('worker_availability').where({ id: availabilityId }).first();
    if (!availability) {
      return { error: 'AVAILABILITY_NOT_FOUND', message: 'Disponibilidad no encontrada' };
    }

    const worker = await this.getOwnedWorker(availability.worker_id, userId);
    if (!worker) {
      return {
        error: 'AVAILABILITY_NOT_FOUND',
        message: 'Disponibilidad no encontrada o no tienes permiso',
      };
    }

    await db('worker_availability').where({ id: availabilityId }).del();

    logger.info('[AUDITORIA] Disponibilidad eliminada', {
      worker_id: availability.worker_id,
      availability_id: availabilityId,
      timestamp: new Date().toISOString(),
    });

    return { deleted: true };
  }
}

export default new WorkerAvailabilityService();
