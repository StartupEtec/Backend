import { jest } from '@jest/globals';

const mockCompressAndStoreImage = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.unstable_mockModule('../src/services/ImageService.js', () => ({
  default: {
    compressAndStoreImage: mockCompressAndStoreImage,
  },
}));

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: jest.fn(),
    debug: jest.fn(),
  },
  asyncLocalStorage: { getStore: () => undefined },
}));

const { default: uploadController } = await import('../src/controllers/UploadController.js');
const { uploadProfileImage } = await import('../src/middlewares/upload.js');

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('POST /api/v1/uploads/profile-image', () => {
  beforeEach(() => {
    mockCompressAndStoreImage.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();
  });

  describe('UploadController', () => {
    it('should return 201 with the stored URL', async () => {
      mockCompressAndStoreImage.mockResolvedValue({ url: '/uploads/profiles/abc.jpg' });

      const req = {
        user: { user_id: 'user-uuid' },
        file: { buffer: Buffer.from('fake'), size: 2048, mimetype: 'image/jpeg' },
      };
      const res = buildRes();
      const next = jest.fn();

      await uploadController.uploadProfileImage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/uploads/profiles/abc.jpg' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should store the image in the profiles folder', async () => {
      mockCompressAndStoreImage.mockResolvedValue({ url: '/uploads/profiles/abc.jpg' });

      const req = {
        user: { user_id: 'user-uuid' },
        file: { buffer: Buffer.from('fake'), size: 10, mimetype: 'image/jpeg' },
      };

      await uploadController.uploadProfileImage(req, buildRes(), jest.fn());

      expect(mockCompressAndStoreImage).toHaveBeenCalledWith(req.file.buffer, {
        folder: 'profiles',
      });
    });

    it('should return 400 when no file is attached', async () => {
      const res = buildRes();

      await uploadController.uploadProfileImage({ user: { user_id: 'u' } }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });

    it('should return 400 when the file is not a valid image', async () => {
      mockCompressAndStoreImage.mockResolvedValue({ error: 'INVALID_IMAGE' });

      const req = {
        user: { user_id: 'user-uuid' },
        file: { buffer: Buffer.from('not an image'), size: 10, mimetype: 'image/jpeg' },
      };
      const res = buildRes();

      await uploadController.uploadProfileImage(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_IMAGE' }));
    });

    it('should return 400 for non JPG/PNG images', async () => {
      mockCompressAndStoreImage.mockResolvedValue({ error: 'INVALID_IMAGE_TYPE' });

      const req = {
        user: { user_id: 'user-uuid' },
        file: { buffer: Buffer.from('gif'), size: 10, mimetype: 'image/gif' },
      };
      const res = buildRes();

      await uploadController.uploadProfileImage(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'INVALID_IMAGE_TYPE' }),
      );
    });

    it('should delegate unexpected errors to next()', async () => {
      const boom = new Error('disk full');
      mockCompressAndStoreImage.mockRejectedValue(boom);

      const req = {
        user: { user_id: 'user-uuid' },
        file: { buffer: Buffer.from('x'), size: 10, mimetype: 'image/jpeg' },
      };
      const next = jest.fn();

      await uploadController.uploadProfileImage(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe('uploadProfileImage middleware', () => {
    it('should accept JPG and PNG mimetypes', () => {
      const fileFilter = uploadProfileImage.fileFilter;

      const accept = jest.fn();
      fileFilter({}, { mimetype: 'image/jpeg' }, accept);

      expect(accept).toHaveBeenCalledWith(null, true);
    });

    it('should reject a non JPG/PNG mimetype', () => {
      const fileFilter = uploadProfileImage.fileFilter;

      const accept = jest.fn();
      fileFilter({}, { mimetype: 'application/pdf' }, accept);

      const [err] = accept.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('INVALID_FILE_TYPE');
    });
  });
});
