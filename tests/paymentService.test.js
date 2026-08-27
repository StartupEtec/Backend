import { jest } from '@jest/globals';
import { encrypt } from '../src/utils/encryption.js';

// ---------------------------------------------------------------------------
// Stripe mock. Forzamos STRIPE_SECRET_KEY antes de importar PaymentService para
// que se construya `new Stripe(secret)` (línea 8) y así controlar
// paymentIntents.create en cada escenario (éxito, 3DS, declined, errores).
// ---------------------------------------------------------------------------
const stripeCreate = jest.fn();
const stripeConstructEvent = jest.fn((rawBody) => JSON.parse(rawBody.toString()));
const stripeInstances = [];

class StripeMock {
  constructor(secret) {
    this._secret = secret;
    this.paymentIntents = { create: stripeCreate };
    this.webhooks = { constructEvent: stripeConstructEvent };
    stripeInstances.push(this);
  }
}

jest.unstable_mockModule('stripe', () => ({ default: StripeMock }));

process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'row-id' }]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    then: (onFulfilled) => Promise.resolve([]).then(onFulfilled),
  };
  builder.insert.mockImplementation(() => builder);
  return builder;
};

const builders = {};
const getBuilder = (table) => {
  if (!builders[table]) {
    builders[table] = makeBuilder();
  }
  return builders[table];
};

const mockKnex = Object.assign((table) => getBuilder(table), {
  transaction: async (cb) => {
    const trx = Object.assign((table) => getBuilder(table), {
      fn: { now: () => new Date() },
    });
    return cb(trx);
  },
  fn: { now: () => new Date() },
  raw: (val) => val,
});

jest.unstable_mockModule('../src/database/db.js', () => ({
  default: mockKnex,
}));

const { default: paymentService } = await import('../src/services/PaymentService.js');

// Restaurar para no contaminar otros archivos que corran en el mismo worker.
delete process.env.STRIPE_SECRET_KEY;

const ORDER = {
  id: 'order-uuid',
  client_id: 'client-uuid',
  worker_id: 'worker-uuid',
  status: 'PENDING',
};
const CLIENT_PROFILE = { id: 'client-uuid', user_id: 'user-uuid' };
const CARD = (cardNumber) => ({
  id: 'method-uuid',
  user_id: 'user-uuid',
  encrypted_card_number: encrypt(cardNumber),
});
const PAYMENT_ROW = {
  id: 'method-uuid',
  user_id: 'user-uuid',
  card_number_masked: '**** **** **** 1111',
  card_brand: 'Visa',
  exp_month: 12,
  exp_year: 2030,
  cardholder_name: 'Juan Perez',
  is_primary: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const setOrders = (order = ORDER) => getBuilder('orders').first.mockResolvedValue(order);
const setClient = (profile = CLIENT_PROFILE) =>
  getBuilder('client_profiles').first.mockResolvedValue(profile);

describe('PaymentService — cobertura de gaps', () => {
  beforeEach(() => {
    Object.keys(builders).forEach((key) => {
      delete builders[key];
    });
    stripeCreate.mockReset();
    stripeConstructEvent
      .mockReset()
      .mockImplementation((rawBody) => JSON.parse(rawBody.toString()));
  });

  describe('listUserPaymentMethods', () => {
    it('should map DB rows to the public shape', async () => {
      getBuilder('payment_methods').then = (onFulfilled) =>
        Promise.resolve([PAYMENT_ROW]).then(onFulfilled);

      const methods = await paymentService.listUserPaymentMethods('user-uuid');
      expect(methods).toHaveLength(1);
      expect(methods[0].card_number_masked).toBe(PAYMENT_ROW.card_number_masked);
      expect(methods[0].card_brand).toBe('Visa');
      expect(methods[0].encrypted_card_number).toBeUndefined();
    });
  });

  describe('createPaymentMethod — detección de marca', () => {
    const runCreate = async (cardNumber) => {
      const returned = { ...PAYMENT_ROW, card_brand: 'X' };
      getBuilder('payment_methods').returning.mockResolvedValue([returned]);
      await paymentService.createPaymentMethod('user-uuid', {
        card_number: cardNumber,
        cvv: '123',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Perez',
      });
      return getBuilder('payment_methods').insert.mock.calls.map((call) => call[0]);
    };

    it('should detect Mastercard (5- and 2-series)', async () => {
      const inserts1 = await runCreate('5105105105105100');
      expect(inserts1[0].card_brand).toBe('Mastercard');
      const inserts2 = await runCreate('2223003122003222');
      expect(inserts2[0].card_brand).toBe('Mastercard');
    });

    it('should detect American Express', async () => {
      const inserts = await runCreate('340000000000009');
      expect(inserts[0].card_brand).toBe('American Express');
    });

    it('should classify unknown brands as Other', async () => {
      const inserts = await runCreate('6011111111111117');
      expect(inserts[0].card_brand).toBe('Other');
    });

    it('should force the first card to be primary', async () => {
      const returned = { ...PAYMENT_ROW, is_primary: true };
      getBuilder('payment_methods').returning.mockResolvedValue([returned]);
      getBuilder('payment_methods').count.mockResolvedValue([{ count: 0 }]);

      await paymentService.createPaymentMethod('user-uuid', {
        card_number: '4111111111111111',
        cvv: '123',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Perez',
        is_primary: false,
      });

      const insertCall = getBuilder('payment_methods').insert.mock.calls[0][0];
      expect(insertCall.is_primary).toBe(true);
    });
  });

  describe('updatePaymentMethod', () => {
    it('should return PAYMENT_METHOD_NOT_FOUND', async () => {
      getBuilder('payment_methods').first.mockResolvedValue(null);
      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        exp_month: 1,
      });
      expect(res.error).toBe('PAYMENT_METHOD_NOT_FOUND');
    });

    it('should return FORBIDDEN for another user method', async () => {
      getBuilder('payment_methods').first.mockResolvedValue({
        id: 'method-uuid',
        user_id: 'other',
      });
      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        exp_month: 1,
      });
      expect(res.error).toBe('FORBIDDEN');
    });

    it('should set a card as primary and unset the others', async () => {
      const initial = { ...PAYMENT_ROW, is_primary: false };
      const updated = { ...PAYMENT_ROW, is_primary: true };
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(updated);

      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        is_primary: true,
      });

      expect(res.paymentMethod.is_primary).toBe(true);
      expect(getBuilder('payment_methods').update).toHaveBeenCalledWith({ is_primary: false });
      expect(getBuilder('payment_methods').update).toHaveBeenCalledWith(
        expect.objectContaining({ is_primary: true }),
      );
    });

    it('should reassign primary to another card when unsetting the only primary among several', async () => {
      const initial = { ...PAYMENT_ROW, is_primary: true };
      const another = { id: 'other-method', is_primary: false };
      const updated = { ...PAYMENT_ROW, is_primary: false };
      getBuilder('payment_methods').count.mockResolvedValue([{ count: 2 }]);
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(another)
        .mockResolvedValueOnce(updated);

      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        is_primary: false,
      });

      expect(res.paymentMethod.is_primary).toBe(false);
      expect(getBuilder('payment_methods').where).toHaveBeenCalledWith({ id: 'other-method' });
      expect(getBuilder('payment_methods').update).toHaveBeenCalledWith({ is_primary: true });
    });

    it('should keep the unique primary card when asked to unset it', async () => {
      const initial = { ...PAYMENT_ROW, is_primary: true };
      const updated = { ...PAYMENT_ROW, is_primary: true };
      getBuilder('payment_methods').count.mockResolvedValue([{ count: 1 }]);
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(updated);

      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        is_primary: false,
      });

      expect(res.paymentMethod.is_primary).toBe(true);
      expect(getBuilder('payment_methods').update).not.toHaveBeenCalledWith(
        expect.objectContaining({ is_primary: false }),
      );
    });

    it('should update data fields without primary changes', async () => {
      const updated = { ...PAYMENT_ROW, exp_month: 5, cardholder_name: 'Ana Lopez' };
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce(PAYMENT_ROW)
        .mockResolvedValue(updated);

      const res = await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {
        exp_month: 5,
        cardholder_name: 'Ana Lopez',
      });

      expect(res.paymentMethod.exp_month).toBe(5);
      expect(getBuilder('payment_methods').update).toHaveBeenCalledWith(
        expect.objectContaining({ exp_month: 5, cardholder_name: 'Ana Lopez' }),
      );
    });

    it('should not update when there are no fields to change', async () => {
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce(PAYMENT_ROW)
        .mockResolvedValue(PAYMENT_ROW);

      await paymentService.updatePaymentMethod('method-uuid', 'user-uuid', {});
      expect(getBuilder('payment_methods').update).not.toHaveBeenCalled();
    });
  });

  describe('deletePaymentMethod', () => {
    it('should return PAYMENT_METHOD_NOT_FOUND', async () => {
      getBuilder('payment_methods').first.mockResolvedValue(null);
      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.error).toBe('PAYMENT_METHOD_NOT_FOUND');
    });

    it('should return FORBIDDEN for another user method', async () => {
      getBuilder('payment_methods').first.mockResolvedValue({
        id: 'method-uuid',
        user_id: 'other',
      });
      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.error).toBe('FORBIDDEN');
    });

    it('should refuse deletion with pending transactions', async () => {
      getBuilder('payment_methods').first.mockResolvedValue({ ...PAYMENT_ROW, is_primary: false });
      getBuilder('transactions').whereIn.mockResolvedValue([{ id: 'tx', status: 'PENDING' }]);

      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.error).toBe('PENDING_TRANSACTIONS');
    });

    it('should delete a non-primary card', async () => {
      getBuilder('payment_methods').first.mockResolvedValue({ ...PAYMENT_ROW, is_primary: false });

      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.success).toBe(true);
      expect(getBuilder('payment_methods').del).toHaveBeenCalled();
    });

    it('should reassign primary when deleting the primary card', async () => {
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce({ ...PAYMENT_ROW, is_primary: true })
        .mockResolvedValueOnce({ id: 'other-method' });

      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.success).toBe(true);
      expect(getBuilder('payment_methods').where).toHaveBeenCalledWith({ id: 'other-method' });
      expect(getBuilder('payment_methods').update).toHaveBeenCalledWith({ is_primary: true });
    });

    it('should delete the primary card without reassigning when it is the only one', async () => {
      getBuilder('payment_methods')
        .first.mockResolvedValueOnce({ ...PAYMENT_ROW, is_primary: true })
        .mockResolvedValueOnce(null);

      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.success).toBe(true);
      expect(getBuilder('payment_methods').update).not.toHaveBeenCalled();
    });
  });

  describe('processStripePayment — edge cases', () => {
    it('should return PAYMENT_METHOD_NOT_FOUND', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(null);

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('PAYMENT_METHOD_NOT_FOUND');
    });

    it('should refuse payment already started or completed (ESCROWED)', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions').first.mockResolvedValue({
        id: 'tx-uuid',
        status: 'ESCROWED',
      });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('PAYMENT_ALREADY_STARTED');
      expect(stripeCreate).not.toHaveBeenCalled();
    });

    it('should update an existing PENDING transaction to ESCROWED on success', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions')
        .first.mockResolvedValueOnce({ id: 'existing-tx', status: 'PENDING' })
        .mockResolvedValueOnce({ id: 'existing-tx' });
      stripeCreate.mockResolvedValue({ status: 'succeeded', amount: 10000 });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('succeeded');
      expect(getBuilder('transactions').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ESCROWED' }),
      );
      expect(getBuilder('user_wallets').increment).toHaveBeenCalledWith('escrowed_balance', 100);
    });

    it('should insert a new transaction on success when none exists', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions')
        .first.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-tx' });
      stripeCreate.mockResolvedValue({ status: 'succeeded', amount: 10000 });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('succeeded');
      expect(getBuilder('transactions').insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ESCROWED', order_id: 'order-uuid' }),
      );
    });

    it('should require 3D Secure action and keep the PENDING transaction', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111113021'));
      getBuilder('transactions').first.mockResolvedValueOnce({
        id: 'existing-tx',
        status: 'PENDING',
      });
      stripeCreate.mockResolvedValue({
        status: 'requires_action',
        client_secret: 'cs_secret',
        next_action: { type: 'use_stripe_sdk' },
      });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('requires_action');
      expect(stripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ payment_method: 'pm_card_threeDSecureRequired' }),
      );
      expect(getBuilder('transactions').insert).not.toHaveBeenCalled();
    });

    it('should persist a PENDING transaction for 3D Secure when none exists', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111113021'));
      getBuilder('transactions').first.mockResolvedValue(null);
      stripeCreate.mockResolvedValue({
        status: 'requires_action',
        client_secret: 'cs_secret',
        next_action: {},
      });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('requires_action');
      expect(getBuilder('transactions').insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      );
    });

    it('should decline when Stripe returns an unknown status', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions').first.mockResolvedValue(null);
      stripeCreate.mockResolvedValue({ status: 'processing' });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('PAYMENT_DECLINED');
    });

    it('should retry transient errors and succeed (runWithRetry)', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions')
        .first.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-tx' });
      const transientError = Object.assign(new Error('connection reset'), {
        type: 'StripeConnectionError',
      });
      stripeCreate
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ status: 'succeeded', amount: 10000 });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('succeeded');
      expect(stripeCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-transient errors and fail the payment', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions').first.mockResolvedValue(null);
      stripeCreate.mockRejectedValue(
        Object.assign(new Error('card declined by issuer'), {
          type: 'StripeInvalidRequestError',
          statusCode: 400,
        }),
      );

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('PAYMENT_FAILED');
      expect(stripeCreate).toHaveBeenCalledTimes(1);
      expect(getBuilder('transactions').insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
    });

    it('should mark the existing transaction FAILED and return PAYMENT_FAILED when retries exhaust', async () => {
      setOrders();
      setClient();
      getBuilder('payment_methods').first.mockResolvedValue(CARD('4111111111111111'));
      getBuilder('transactions').first.mockResolvedValue({ id: 'existing-tx', status: 'PENDING' });
      stripeCreate.mockRejectedValue(
        Object.assign(new Error('upstream timeout'), {
          type: 'StripeAPIError',
        }),
      );

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('PAYMENT_FAILED');
      expect(getBuilder('transactions').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
    });
  });

  describe('handleWebhookPaymentIntentSucceeded', () => {
    const intent = {
      amount: 10000,
      metadata: {
        order_id: 'order-uuid',
        payer_id: 'user-uuid',
        receiver_id: 'worker-uuid',
        payment_method_id: 'method-uuid',
      },
    };

    it('should ignore events for already-escrowed/completed transactions', async () => {
      getBuilder('orders').first.mockResolvedValue({ id: 'order-uuid', status: 'PENDING' });
      getBuilder('transactions').first.mockResolvedValue({ id: 'tx-uuid', status: 'ESCROWED' });

      await paymentService.handleWebhookPaymentIntentSucceeded(intent);
      expect(getBuilder('user_wallets').increment).not.toHaveBeenCalled();
      expect(getBuilder('transactions').update).not.toHaveBeenCalled();
    });

    it('should escrow funds and accept the order when no transaction exists', async () => {
      getBuilder('orders').first.mockResolvedValue({ id: 'order-uuid', status: 'PENDING' });
      getBuilder('transactions')
        .first.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-tx' });

      await paymentService.handleWebhookPaymentIntentSucceeded(intent);

      expect(getBuilder('transactions').insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ESCROWED', order_id: 'order-uuid' }),
      );
      expect(getBuilder('user_wallets').increment).toHaveBeenCalledWith('escrowed_balance', 100);
      expect(getBuilder('orders').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED' }),
      );
      expect(getBuilder('order_events').insert).toHaveBeenCalled();
    });

    it('should update an existing PENDING transaction but not change a non-pending order', async () => {
      getBuilder('orders').first.mockResolvedValue({ id: 'order-uuid', status: 'ACCEPTED' });
      getBuilder('transactions')
        .first.mockResolvedValueOnce({ id: 'existing-tx', status: 'PENDING' })
        .mockResolvedValueOnce({ id: 'existing-tx' });

      await paymentService.handleWebhookPaymentIntentSucceeded(intent);

      expect(getBuilder('transactions').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ESCROWED' }),
      );
      expect(getBuilder('orders').update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookPaymentIntentFailed', () => {
    const intent = {
      amount: 10000,
      metadata: {
        order_id: 'order-uuid',
        payer_id: 'user-uuid',
        receiver_id: 'worker-uuid',
        payment_method_id: 'method-uuid',
      },
    };

    it('should mark the existing transaction FAILED and cancel the order', async () => {
      getBuilder('transactions')
        .first.mockResolvedValueOnce({ id: 'existing-tx', status: 'PENDING' })
        .mockResolvedValueOnce({ id: 'existing-tx' });

      await paymentService.handleWebhookPaymentIntentFailed(intent);

      expect(getBuilder('transactions').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
      expect(getBuilder('orders').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' }),
      );
      expect(getBuilder('transaction_logs').insert).toHaveBeenCalled();
    });

    it('should cancel the order even when there is no transaction to mark', async () => {
      getBuilder('transactions').first.mockResolvedValue(null);

      await paymentService.handleWebhookPaymentIntentFailed(intent);

      expect(getBuilder('orders').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' }),
      );
      expect(getBuilder('transaction_logs').insert).not.toHaveBeenCalled();
    });
  });

  describe('constructStripeWebhookEvent', () => {
    it('should parse the raw body into an event', () => {
      const raw = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded', data: {} }));
      const event = paymentService.constructStripeWebhookEvent(raw, 'sig');
      expect(event.type).toBe('payment_intent.succeeded');
      expect(stripeConstructEvent).toHaveBeenCalled();
    });
  });

  describe('instancia de Stripe', () => {
    it('should build a real Stripe instance when STRIPE_SECRET_KEY is set', () => {
      expect(stripeInstances.length).toBeGreaterThan(0);
      expect(stripeInstances[0]._secret).toBe('sk_test_mock_key');
    });
  });
});
