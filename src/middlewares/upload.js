import multer from 'multer';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Solo se permiten imágenes JPG o PNG');
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
};

export const uploadMessageImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter,
});

// Multer rechaza el archivo en el middleware, antes de llegar al controller;
// este handler traduce esos errores a respuestas 400 estandarizadas.
export function handleUploadError(err, req, res, next) {
  if (err.name === 'MulterError' || err.code === 'INVALID_FILE_TYPE') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo no debe superar el límite de tamaño permitido'
        : err.message || 'Error al procesar el archivo adjunto';
    return res.status(400).json({
      error: 'UPLOAD_ERROR',
      message,
      statusCode: 400,
      timestamp: new Date().toISOString(),
    });
  }
  next(err);
}

const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const docFileFilter = (req, file, cb) => {
  if (ALLOWED_DOC_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Solo se permiten documentos PDF o imágenes JPG/PNG');
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
};

export const uploadCertificationDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE, files: 1 },
  fileFilter: docFileFilter,
});
