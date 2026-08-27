import * as validation from '../src/utils/validation.js';

const UUID = '12345678-1234-1234-1234-123456789012';

const expectValid = (schema, value) => {
  const { error, value: result } = schema.validate(value, { abortEarly: false });
  expect(error).toBeUndefined();
  return result;
};

const expectInvalid = (schema, value, fragment) => {
  const { error } = schema.validate(value, { abortEarly: false });
  const messages = error ? error.details.map((d) => d.message).join(' | ') : '';
  expect(error).toBeDefined();
  if (fragment) expect(messages).toContain(fragment);
  return messages;
};

describe('Validaciones de entrada (src/utils/validation.js)', () => {
  describe('Auth', () => {
    it('registerSchema: acepta credenciales válidas', () => {
      expectValid(validation.registerSchema, {
        email: 'user@example.com',
        phone: '12345678',
        password: 'Strong1!',
      });
    });

    it('registerSchema: rechaza email inválido y contraseña débil', () => {
      const messages = expectInvalid(validation.registerSchema, {
        email: 'not-an-email',
        phone: '12345678',
        password: 'weak',
      });
      expect(messages).toContain('formato del correo');
      expect(messages).toContain('al menos 8 caracteres');
    });

    it('registerSchema: requiere todos los campos', () => {
      expectInvalid(validation.registerSchema, {}, 'es requerido');
    });

    it('loginSchema: requiere email o teléfono', () => {
      expectInvalid(validation.loginSchema, { password: 'Strong1!' }, 'correo electrónico');
      expectValid(validation.loginSchema, { email: 'user@example.com', password: 'Strong1!' });
    });

    it('verifyOtpSchema: el OTP debe tener 6 dígitos', () => {
      expectInvalid(validation.verifyOtpSchema, { phone: '12345678', otp_code: '12' }, '6 dígitos');
      expectValid(validation.verifyOtpSchema, { email: 'user@example.com', otp_code: '123456' });
    });

    it('refreshTokenSchema: requiere refreshToken', () => {
      expectInvalid(validation.refreshTokenSchema, {}, 'es requerido');
      expectValid(validation.refreshTokenSchema, { refreshToken: 'token.value' });
    });

    it('forgotPasswordSchema: requiere email o teléfono', () => {
      expectInvalid(validation.forgotPasswordSchema, {}, 'correo electrónico');
    });

    it('verifyResetCodeSchema: el código de recuperación debe tener 6 dígitos', () => {
      expectInvalid(
        validation.verifyResetCodeSchema,
        { email: 'a@b.com', reset_code: 'abc' },
        '6 dígitos',
      );
    });

    it('resetPasswordSchema: requiere token y contraseña segura', () => {
      expectInvalid(validation.resetPasswordSchema, { password: 'weak' }, 'token temporal');
      expectInvalid(
        validation.resetPasswordSchema,
        { token: 't', password: 'weak' },
        '8 caracteres',
      );
      expectValid(validation.resetPasswordSchema, { token: 't', password: 'NuevaPass1!' });
    });
  });

  describe('Perfiles', () => {
    it('createClientProfileSchema: valida avatar, bio y ubicación', () => {
      expectValid(validation.createClientProfileSchema, { full_name: 'Ana' });
      expectInvalid(
        validation.createClientProfileSchema,
        { full_name: 'Ana', avatar_url: 'https://x.com/a.txt' },
        'JPG o PNG',
      );
      expectInvalid(
        validation.createClientProfileSchema,
        { full_name: 'Ana', default_location_id: 'not-a-uuid' },
        'UUID válido',
      );
      expectInvalid(validation.createClientProfileSchema, {}, 'nombre es requerido');
    });

    it('updateClientProfileSchema: requiere al menos un campo', () => {
      expectInvalid(validation.updateClientProfileSchema, {}, 'al menos un campo');
      expectValid(validation.updateClientProfileSchema, { bio: 'hola' });
    });

    it('updateProfileSchema: valida nombre requerido', () => {
      expectInvalid(validation.updateProfileSchema, { full_name: '' }, 'no puede estar vacío');
      expectValid(validation.updateProfileSchema, { full_name: 'Ana', bio: 'x' });
    });

    it('createWorkerProfileSchema: valida categoría, tarifa y disponibilidad', () => {
      const base = {
        full_name: 'Ana',
        category_id: UUID,
        hourly_rate: 25,
      };
      expectValid(validation.createWorkerProfileSchema, base);
      expectInvalid(validation.createWorkerProfileSchema, { ...base, hourly_rate: -1 }, 'positivo');
      expectInvalid(
        validation.createWorkerProfileSchema,
        { ...base, availability_status: 'NOPE' },
        'AVAILABLE',
      );
      expectInvalid(validation.createWorkerProfileSchema, { ...base, category_id: 'x' }, 'UUID');
    });

    it('switchRoleSchema: solo acepta client o worker', () => {
      expectInvalid(validation.switchRoleSchema, { role: 'admin' }, 'client o worker');
      expectValid(validation.switchRoleSchema, { role: 'worker' });
    });
  });

  describe('Ubicaciones y búsqueda', () => {
    it('createLocationSchema: valida rangos de coordenadas', () => {
      expectValid(validation.createLocationSchema, {
        address: 'Av. Siempre Viva',
        latitude: -33.4,
        longitude: -70.6,
      });
      expectInvalid(
        validation.createLocationSchema,
        { address: 'x', latitude: 91, longitude: 0 },
        'entre -90 y 90',
      );
      expectInvalid(
        validation.createLocationSchema,
        { latitude: 0, longitude: 0 },
        'dirección es requerida',
      );
    });

    it('updateLocationSchema: requiere al menos un campo', () => {
      expectInvalid(validation.updateLocationSchema, {}, 'al menos un campo');
    });

    it('listLocationsQuerySchema: lat y lng van juntos', () => {
      expectInvalid(validation.listLocationsQuerySchema, { lat: 10 });
      expectValid(validation.listLocationsQuerySchema, { lat: 10, lng: 20 });
    });
  });

  describe('Chat y mensajes', () => {
    it('createChatSchema: user_id_2 es un UUID requerido', () => {
      expectInvalid(validation.createChatSchema, { user_id_2: 'no' }, 'UUID');
      expectValid(validation.createChatSchema, { user_id_2: UUID });
    });

    it('listChatsQuerySchema: valida limit y status', () => {
      expectInvalid(validation.listChatsQuerySchema, { status: 'weird' }, 'all, favorites');
      expectInvalid(validation.listChatsQuerySchema, { limit: 500 }, '100');
      expectValid(validation.listChatsQuerySchema, {});
    });

    it('createMessageSchema: contenido requerido salvo IMAGE', () => {
      expectInvalid(
        validation.createMessageSchema,
        { message_type: 'TEXT' },
        'content es requerido',
      );
      expectValid(validation.createMessageSchema, { message_type: 'IMAGE' });
      expectValid(validation.createMessageSchema, { message_type: 'TEXT', content: 'hola' });
      expectInvalid(
        validation.createMessageSchema,
        { message_type: 'AUDIO' },
        'TEXT, IMAGE o QUOTE',
      );
    });

    it('listMessagesQuerySchema: valida rangos', () => {
      expectInvalid(validation.listMessagesQuerySchema, { offset: -1 }, 'no puede ser negativo');
    });
  });

  describe('Cotizaciones y órdenes', () => {
    const quote = { proposed_price: 100, proposed_time: '14:30' };

    it('createQuoteSchema: rechaza fechas pasadas y horas inválidas', () => {
      expectInvalid(
        validation.createQuoteSchema,
        { ...quote, proposed_date: '2020-01-01' },
        'hoy o una fecha futura',
      );
      expectInvalid(
        validation.createQuoteSchema,
        { ...quote, proposed_date: '2030-01-01', proposed_time: '25:99' },
        'HH:mm',
      );
      expectValid(validation.createQuoteSchema, { ...quote, proposed_date: '2030-01-01' });
    });

    it('updateQuoteStatusSchema: solo ACCEPTED, REJECTED o CANCELLED', () => {
      expectInvalid(
        validation.updateQuoteStatusSchema,
        { status: 'PAID' },
        'ACCEPTED, REJECTED o CANCELLED',
      );
      expectValid(validation.updateQuoteStatusSchema, {
        status: 'REJECTED',
        rejection_reason: 'Caro',
      });
    });

    it('updateOrderStatusSchema: solo estados válidos', () => {
      expectInvalid(validation.updateOrderStatusSchema, { status: 'DONE' }, 'IN_PROGRESS');
      expectValid(validation.updateOrderStatusSchema, { status: 'COMPLETED' });
    });

    it('createOrderSchema: cliente y trabajador no pueden coincidir', () => {
      const base = { client_id: UUID, category_id: UUID, location_id: UUID };
      expectInvalid(
        validation.createOrderSchema,
        { ...base, worker_id: UUID },
        'no pueden ser el mismo usuario',
      );
      expectValid(validation.createOrderSchema, {
        ...base,
        worker_id: '87654321-4321-4321-4321-210987654321',
      });
    });

    it('listUserOrdersQuerySchema: valida status y fechas', () => {
      expectInvalid(validation.listUserOrdersQuerySchema, { status: 'NOPE' }, 'PENDING');
      expectInvalid(validation.listUserOrdersQuerySchema, { date_from: 'ayer' }, 'ISO');
      expectValid(validation.listUserOrdersQuerySchema, {});
    });

    it('completeOrderSchema: confirm por defecto true', () => {
      expect(expectValid(validation.completeOrderSchema, {}).confirm).toBe(true);
      expectInvalid(validation.completeOrderSchema, { confirm: 'yes' }, 'booleano');
    });
  });

  describe('Pagos', () => {
    const currentYear = new Date().getFullYear();
    const card = {
      cvv: '123',
      exp_month: 12,
      exp_year: currentYear + 1,
      cardholder_name: 'Juan Perez',
    };

    it('createPaymentMethodSchema: rechaza números que no pasan Luhn', () => {
      expectInvalid(
        validation.createPaymentMethodSchema,
        { ...card, card_number: '4111111111111112' },
        'verificación Luhn',
      );
    });

    it('createPaymentMethodSchema: acepta una tarjeta válida', () => {
      expectValid(validation.createPaymentMethodSchema, {
        ...card,
        card_number: '4111111111111111',
      });
    });

    it('createPaymentMethodSchema: rechaza tarjetas expiradas y datos inválidos', () => {
      const currentMonth = new Date().getMonth() + 1;
      if (currentMonth > 1) {
        expectInvalid(
          validation.createPaymentMethodSchema,
          { ...card, card_number: '4111111111111111', exp_year: currentYear, exp_month: 1 },
          'ya ha expirado',
        );
      }
      expectInvalid(
        validation.createPaymentMethodSchema,
        { ...card, card_number: '4111111111111111', cvv: '12' },
        'CVV',
      );
      expectInvalid(
        validation.createPaymentMethodSchema,
        { ...card, card_number: '4111111111111111', exp_year: 1990 },
        'pasado',
      );
    });

    it('updatePaymentMethodSchema: requiere al menos un campo', () => {
      expectInvalid(validation.updatePaymentMethodSchema, {}, 'al menos un campo');
      expectValid(validation.updatePaymentMethodSchema, { cardholder_name: 'Ana Lopez' });
    });

    it('processPaymentSchema: valida UUIDs y monto positivo', () => {
      expectInvalid(
        validation.processPaymentSchema,
        { order_id: 'x', payment_method_id: UUID, amount: -5 },
        'UUID',
      );
      expectValid(validation.processPaymentSchema, {
        order_id: UUID,
        payment_method_id: UUID,
        amount: 100,
      });
    });
  });

  describe('Certificaciones, ratings y disputas', () => {
    it('createCertificationSchema: valida el tipo de documento', () => {
      expectInvalid(
        validation.createCertificationSchema,
        { document_type: 'TITOLO' },
        'BACKGROUND_CHECK',
      );
      expectValid(validation.createCertificationSchema, { document_type: 'ID_VERIFICATION' });
    });

    it('updateCertificationStatusSchema: requiere motivo al rechazar', () => {
      expectInvalid(
        validation.updateCertificationStatusSchema,
        { verification_status: 'REJECTED' },
        'motivo',
      );
      expectInvalid(
        validation.updateCertificationStatusSchema,
        { verification_status: 'REJECTED', rejected_reason: 'mal' },
        '5 caracteres',
      );
      expectValid(validation.updateCertificationStatusSchema, { verification_status: 'APPROVED' });
    });

    it('createRatingSchema: estrellas entre 1 y 5 enteras', () => {
      expectInvalid(validation.createRatingSchema, { order_id: UUID, rating_stars: 6 }, '5');
      expectInvalid(validation.createRatingSchema, { order_id: UUID, rating_stars: 2.5 }, 'entero');
      expectValid(validation.createRatingSchema, {
        order_id: UUID,
        rating_stars: 4,
        review_text: 'Excelente',
      });
    });

    it('listRatingsQuerySchema: valida offset', () => {
      expectInvalid(validation.listRatingsQuerySchema, { offset: -1 }, 'negativo');
    });

    it('createDisputeSchema: razón mínima y URL de evidencia válida', () => {
      expectInvalid(
        validation.createDisputeSchema,
        { order_id: UUID, reason: 'corto' },
        '10 caracteres',
      );
      expectInvalid(
        validation.createDisputeSchema,
        { order_id: UUID, reason: 'razon muy larga', evidence_url: 'not-a-url' },
        'enlace válido',
      );
      expectValid(validation.createDisputeSchema, {
        order_id: UUID,
        reason: 'No se hizo el trabajo',
      });
    });

    it('resolveDisputeSchema: el ganador es requerido al resolver', () => {
      expectInvalid(
        validation.resolveDisputeSchema,
        { status: 'RESOLVED', resolution_notes: 'notas largas' },
        'ganador',
      );
      expectInvalid(
        validation.resolveDisputeSchema,
        { status: 'RESOLVED', resolution_notes: 'notas largas', winner: 'admin' },
        'client o worker',
      );
      expectValid(validation.resolveDisputeSchema, {
        status: 'RESOLVED',
        resolution_notes: 'notas largas',
        winner: 'client',
      });
      expectValid(validation.resolveDisputeSchema, {
        status: 'CLOSED',
        resolution_notes: 'notas largas',
      });
    });
  });

  describe('Disponibilidad', () => {
    it('createAvailabilitySchema: start_time debe ser anterior a end_time', () => {
      expectInvalid(
        validation.createAvailabilitySchema,
        { day_of_week: 1, start_time: '10:00', end_time: '10:00' },
        'anterior a end_time',
      );
      expectValid(validation.createAvailabilitySchema, {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
      });
      expectInvalid(
        validation.createAvailabilitySchema,
        { day_of_week: 8, start_time: '09:00', end_time: '17:00' },
        '0 (Domingo) y 6',
      );
    });

    it('updateAvailabilitySchema: requiere al menos un campo', () => {
      expectInvalid(validation.updateAvailabilitySchema, {}, 'al menos un campo');
    });
  });

  describe('Seguridad de cuenta', () => {
    it('changePasswordSchema: requiere contraseña nueva segura', () => {
      expectInvalid(
        validation.changePasswordSchema,
        { current_password: 'x', new_password: 'weak' },
        '8 caracteres',
      );
      expectValid(validation.changePasswordSchema, {
        current_password: 'OldPass1!',
        new_password: 'NewPass1!',
      });
    });

    it('changeEmailSchema: valida formato del correo', () => {
      expectInvalid(validation.changeEmailSchema, { new_email: 'nope' }, 'correo electrónico');
      expectValid(validation.changeEmailSchema, { new_email: 'new@example.com' });
    });

    it('changePhoneSchema: teléfono mínimo 8 dígitos', () => {
      expectInvalid(validation.changePhoneSchema, { new_phone: '123' }, '8 dígitos');
    });

    it('changeEmail/Phone: los OTP deben tener 6 dígitos', () => {
      expectInvalid(
        validation.verifyEmailChangeSchema,
        { current_otp_code: '123', new_otp_code: '123456' },
        '6 dígitos',
      );
      expectInvalid(
        validation.verifyPhoneChangeSchema,
        { current_otp_code: '123456', new_otp_code: '1' },
        '6 dígitos',
      );
      expectValid(validation.verifyEmailChangeSchema, {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
    });
  });

  describe('Notificaciones', () => {
    it('updateNotificationPreferencesSchema: rechaza campos desconocidos y formatos inválidos', () => {
      expectInvalid(
        validation.updateNotificationPreferencesSchema,
        { hacking: true },
        'Campo no permitido',
      );
      expectInvalid(
        validation.updateNotificationPreferencesSchema,
        { dnd_start: '25:00' },
        'HH:MM',
      );
      expectValid(validation.updateNotificationPreferencesSchema, {
        push_enabled: false,
        dnd_start: '22:00',
      });
    });

    it('listNotificationsSchema: valida limit y status', () => {
      expectInvalid(validation.listNotificationsSchema, { limit: 500 }, '50');
      expectInvalid(validation.listNotificationsSchema, { status: 'SENT_FAKE' }, 'PENDING');
      expectValid(validation.listNotificationsSchema, {});
    });

    it('sendTestNotificationSchema: valida tipos y canales', () => {
      expectValid(validation.sendTestNotificationSchema, { channels: ['push', 'sms'] });
      expectInvalid(validation.sendTestNotificationSchema, { channels: ['slack'] }, 'push');
      expectInvalid(
        validation.sendTestNotificationSchema,
        { type: 'FAKE_TYPE' },
        'SERVICE_REQUEST',
      );
    });
  });
});
