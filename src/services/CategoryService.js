import db from '../database/db.js';

class CategoryService {
  /**
   * Lista todas las categorías activas ordenadas alfabéticamente por nombre.
   * @returns {Promise<Array<{ id: string, name: string, description: string|null, icon_url: string|null }>>}
   */
  async listActive() {
    return db('categories')
      .where({ active: true })
      .select('id', 'name', 'description', 'icon_url')
      .orderBy('name', 'asc');
  }
}

export default new CategoryService();
