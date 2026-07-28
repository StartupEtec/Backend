import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_12345';
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'default_refresh_token_secret_key_12345';

class AuthService {
  /**
   * Generates a short-lived access JWT.
   * JWT payload: user_id, email, current_role, iat, exp (1 hour)
   */
  generateAccessToken(user) {
    const payload = {
      user_id: user.id,
      email: user.email,
      current_role: user.current_role || 'client',
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  }

  /**
   * Generates a long-lived refresh token and stores it in the database.
   * Refresh token payload: user_id, jti, exp (7 days)
   */
  async generateRefreshToken(userId) {
    const jti = uuidv4();
    const expiresIn = '7d';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const token = jwt.sign({ user_id: userId, jti }, REFRESH_TOKEN_SECRET, { expiresIn });

    // Store in DB
    await db('refresh_tokens').insert({
      user_id: userId,
      jti,
      expires_at: expiresAt,
    });

    return token;
  }

  /**
   * Validates a refresh token, revokes it, and issues a new access token + refresh token.
   * @param {string} token - The refresh token string.
   * @returns {Promise<{accessToken: string, refreshToken: string}|null>}
   */
  async refreshAccessToken(token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      const { user_id, jti } = decoded;

      // Find token in DB
      const storedToken = await db('refresh_tokens').where({ jti, user_id }).first();

      if (!storedToken) {
        logger.warn(`Intento de refresh token inválido o ya revocado (jti: ${jti})`);
        return null;
      }

      // Check expiry
      if (new Date(storedToken.expires_at) < new Date()) {
        logger.warn(`Refresh token expirado en base de datos (jti: ${jti})`);
        await db('refresh_tokens').where({ jti }).del();
        return null;
      }

      // Revoke old refresh token (Token Rotation for Security)
      await db('refresh_tokens').where({ jti }).del();

      // Retrieve user details
      const user = await db('users').where({ id: user_id }).first();
      if (!user || !user.active) {
        logger.warn(`Usuario inactivo o inexistente intentando refrescar token: ${user_id}`);
        return null;
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user.id);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      logger.error('Error al verificar refresh token:', error);
      return null;
    }
  }

  /**
   * Revokes a refresh token (e.g. on logout).
   */
  async revokeRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      await db('refresh_tokens').where({ jti: decoded.jti }).del();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Decodes and validates access token (used in middlewares).
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

export default new AuthService();
