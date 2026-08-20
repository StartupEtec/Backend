import authService from '../services/AuthService.js';
import logger, { asyncLocalStorage } from '../utils/logger.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token de acceso no proporcionado',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }

  const decoded = authService.verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Token de acceso inválido o expirado',
      statusCode: 403,
      timestamp: new Date().toISOString(),
    });
  }

  req.user = decoded;

  // Inyectar el user_id en el almacenamiento asíncrono para Winston
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userId = decoded.user_id;
  }

  next();
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.current_role) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No autenticado o rol no especificado',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }

    const userRole = req.user.current_role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map((role) => role.toLowerCase());

    // Map 'worker' and 'provider' as equivalent to accommodate both naming conventions if needed
    const matchesRole =
      normalizedAllowedRoles.includes(userRole) ||
      (userRole === 'provider' && normalizedAllowedRoles.includes('worker')) ||
      (userRole === 'worker' && normalizedAllowedRoles.includes('provider'));

    if (!matchesRole) {
      logger.warn(
        `Acceso denegado para el usuario ${req.user.user_id} con rol '${req.user.current_role}' a recurso restringido`,
      );
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No tiene permisos suficientes para acceder a este recurso',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
