import categoryService from '../services/CategoryService.js';
import logger from '../utils/logger.js';

class CategoryController {
  /**
   * Endpoint público GET /api/v1/categories
   * Lista categorías activas para selección de especialidades y filtros.
   */
  async listActive(req, res, next) {
    try {
      const categories = await categoryService.listActive();
      return res.status(200).json({ categories });
    } catch (err) {
      logger.error('Error al listar categorías activas:', err);
      next(err);
    }
  }
}

export default new CategoryController();
