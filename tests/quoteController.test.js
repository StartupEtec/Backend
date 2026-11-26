import { jest } from '@jest/globals';

const quoteServiceMock = {
  createQuote: jest.fn(),
  listQuotesByOrder: jest.fn(),
  getQuoteById: jest.fn(),
  updateQuoteStatus: jest.fn(),
  deleteQuote: jest.fn(),
};

jest.unstable_mockModule('../src/services/QuoteService.js', () => ({
  default: quoteServiceMock,
}));

const { default: quoteController } = await import('../src/controllers/QuoteController.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';
const QUOTE_ID = '33333333-3333-3333-3333-333333333333';
const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const validQuoteBody = {
  proposed_price: 1500,
  proposed_date: futureDate,
  proposed_time: '10:30',
};

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildReq = (body = validQuoteBody) => ({
  user: { user_id: USER_ID },
  params: { order_id: ORDER_ID, quote_id: QUOTE_ID },
  body,
});

describe('QuoteController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('returns 400 when validation fails', async () => {
      const res = buildRes();
      const next = jest.fn();

      await quoteController.create(buildReq({}), res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
      expect(quoteServiceMock.createQuote).not.toHaveBeenCalled();
    });

    it.each([
      ['ORDER_NOT_FOUND', 404],
      ['ORDER_NOT_ACTIVE', 409],
      ['FORBIDDEN', 403],
    ])('maps %s to %i', async (error, statusCode) => {
      quoteServiceMock.createQuote.mockResolvedValue({ error });
      const res = buildRes();
      const next = jest.fn();

      await quoteController.create(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    it('returns 201 when the quote is created', async () => {
      const quote = { id: QUOTE_ID, status: 'PENDING' };
      quoteServiceMock.createQuote.mockResolvedValue(quote);
      const res = buildRes();
      const next = jest.fn();

      await quoteController.create(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cotización creada correctamente',
        quote,
      });
    });
  });

  describe('list', () => {
    it('returns 200 with the quotes and count', async () => {
      const quotes = [{ id: QUOTE_ID, status: 'PENDING' }];
      quoteServiceMock.listQuotesByOrder.mockResolvedValue(quotes);
      const res = buildRes();
      const next = jest.fn();

      await quoteController.list(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ quotes, count: 1 });
    });

    it.each([
      ['ORDER_NOT_FOUND', 404],
      ['FORBIDDEN', 403],
    ])('maps %s to %i', async (error, statusCode) => {
      quoteServiceMock.listQuotesByOrder.mockResolvedValue({ error });
      const res = buildRes();
      const next = jest.fn();

      await quoteController.list(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });
  });

  describe('getById', () => {
    it('returns 404 when the quote does not exist', async () => {
      quoteServiceMock.getQuoteById.mockResolvedValue(null);
      const res = buildRes();
      const next = jest.fn();

      await quoteController.getById(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'QUOTE_NOT_FOUND' }));
    });

    it('returns 200 with the quote', async () => {
      const quote = { id: QUOTE_ID, status: 'PENDING' };
      quoteServiceMock.getQuoteById.mockResolvedValue(quote);
      const res = buildRes();
      const next = jest.fn();

      await quoteController.getById(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(quote);
    });
  });

  describe('updateStatus', () => {
    it('returns 400 when validation fails', async () => {
      const res = buildRes();
      const next = jest.fn();

      await quoteController.updateStatus(buildReq({ status: 'PENDING' }), res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
      expect(quoteServiceMock.updateQuoteStatus).not.toHaveBeenCalled();
    });

    it.each([
      ['QUOTE_NOT_FOUND', 404],
      ['FORBIDDEN', 403],
      ['INVALID_TRANSITION', 409],
      ['PAYMENT_ALREADY_STARTED', 409],
      ['PAYMENT_FAILED', 402],
      ['MISSING_ORDER_PARTICIPANTS', 409],
    ])('maps %s to %i', async (error, statusCode) => {
      quoteServiceMock.updateQuoteStatus.mockResolvedValue({ error, message: 'detalle' });
      const res = buildRes();
      const next = jest.fn();

      await quoteController.updateStatus(buildReq({ status: 'ACCEPTED' }), res, next);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    it('returns 200 when the status changes', async () => {
      const quote = { id: QUOTE_ID, status: 'ACCEPTED' };
      quoteServiceMock.updateQuoteStatus.mockResolvedValue(quote);
      const res = buildRes();
      const next = jest.fn();

      await quoteController.updateStatus(buildReq({ status: 'ACCEPTED' }), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Estado de cotización actualizado correctamente',
        quote,
      });
    });
  });

  describe('remove', () => {
    it.each([
      ['QUOTE_NOT_FOUND', 404],
      ['FORBIDDEN', 403],
      ['QUOTE_NOT_PENDING', 409],
    ])('maps %s to %i', async (error, statusCode) => {
      quoteServiceMock.deleteQuote.mockResolvedValue({ error });
      const res = buildRes();
      const next = jest.fn();

      await quoteController.remove(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    it('returns 200 when the quote is deleted', async () => {
      quoteServiceMock.deleteQuote.mockResolvedValue({});
      const res = buildRes();
      const next = jest.fn();

      await quoteController.remove(buildReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cotización eliminada correctamente' });
    });
  });
});
