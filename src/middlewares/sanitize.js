/**
 * Middleware recursivo de sanitización de entrada para prevenir inyecciones de código XSS
 * eliminando etiquetas HTML y el contenido completo de bloques de scripts.
 */
const cleanValue = (val) => {
  if (typeof val === 'string') {
    // Eliminar etiquetas <script> y su contenido completo, luego quitar cualquier otra etiqueta HTML
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(cleanValue);
  }
  if (typeof val === 'object' && val !== null) {
    const cleaned = {};
    for (const key in val) {
      cleaned[key] = cleanValue(val[key]);
    }
    return cleaned;
  }
  return val;
};

export const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = cleanValue(req.body);
  }
  if (req.query) {
    req.query = cleanValue(req.query);
  }
  if (req.params) {
    req.params = cleanValue(req.params);
  }
  next();
};
