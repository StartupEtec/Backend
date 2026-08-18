import Joi from 'joi';

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'El formato del correo electrónico no es válido',
    'any.required': 'El correo electrónico es requerido',
  }),
  phone: Joi.string().min(8).max(15).required().messages({
    'string.min': 'El teléfono debe tener al menos 8 dígitos',
    'string.max': 'El teléfono no debe exceder los 15 dígitos',
    'any.required': 'El teléfono es requerido',
  }),
  password: Joi.string().pattern(passwordPattern).required().messages({
    'string.pattern.base':
      'La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula, un número y un símbolo',
    'any.required': 'La contraseña es requerida',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().min(8).max(15).optional(),
  password: Joi.string().required().messages({
    'any.required': 'La contraseña es requerida',
  }),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'Debe proporcionar al menos el correo electrónico o el teléfono',
  });

export const verifyOtpSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().min(8).max(15).optional(),
  otp_code: Joi.string().length(6).required().messages({
    'string.length': 'El código OTP debe ser de 6 dígitos',
    'any.required': 'El código OTP es requerido',
  }),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'Debe proporcionar el correo electrónico o el teléfono asociado al OTP',
  });

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'El token de refresco es requerido',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().min(8).max(15).optional(),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'Debe proporcionar al menos el correo electrónico o el teléfono',
  });

export const verifyResetCodeSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().min(8).max(15).optional(),
  reset_code: Joi.string().length(6).required().messages({
    'string.length': 'El código de recuperación debe ser de 6 dígitos',
    'any.required': 'El código de recuperación es requerido',
  }),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'Debe proporcionar el correo electrónico o el teléfono asociado al código',
  });

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'El token temporal es requerido',
  }),
  password: Joi.string().pattern(passwordPattern).required().messages({
    'string.pattern.base':
      'La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula, un número y un símbolo',
    'any.required': 'La contraseña es requerida',
  }),
});

const imageUrlPattern = /\.(jpg|jpeg|png)(\?.*)?$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createClientProfileSchema = Joi.object({
  full_name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'El nombre no puede estar vacío',
    'string.min': 'El nombre debe tener al menos 1 caracter',
    'string.max': 'El nombre no debe exceder los 100 caracteres',
    'any.required': 'El nombre es requerido',
  }),
  avatar_url: Joi.string().allow('', null).pattern(imageUrlPattern).messages({
    'string.pattern.base': 'La URL del avatar debe ser una imagen JPG o PNG válida',
  }),
  bio: Joi.string().max(500).allow('', null).messages({
    'string.max': 'La biografía no debe exceder los 500 caracteres',
  }),
  default_location_id: Joi.string().pattern(uuidPattern).allow(null).messages({
    'string.pattern.base': 'La ubicación por defecto debe ser un UUID válido',
  }),
  preferences: Joi.object().pattern(Joi.string(), Joi.any()).allow(null).messages({
    'object.base': 'Las preferencias deben ser un objeto JSON válido',
  }),
});

export const updateClientProfileSchema = Joi.object({
  full_name: Joi.string().min(1).max(100).messages({
    'string.empty': 'El nombre no puede estar vacío',
    'string.min': 'El nombre debe tener al menos 1 caracter',
    'string.max': 'El nombre no debe exceder los 100 caracteres',
  }),
  avatar_url: Joi.string().allow('', null).pattern(imageUrlPattern).messages({
    'string.pattern.base': 'La URL del avatar debe ser una imagen JPG o PNG válida',
  }),
  bio: Joi.string().max(500).allow('', null).messages({
    'string.max': 'La biografía no debe exceder los 500 caracteres',
  }),
  default_location_id: Joi.string().pattern(uuidPattern).allow(null).messages({
    'string.pattern.base': 'La ubicación por defecto debe ser un UUID válido',
  }),
  preferences: Joi.object().pattern(Joi.string(), Joi.any()).allow(null).messages({
    'object.base': 'Las preferencias deben ser un objeto JSON válido',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar',
  });

export const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'El nombre no puede estar vacío',
    'string.min': 'El nombre debe tener al menos 1 caracter',
    'string.max': 'El nombre no debe exceder los 100 caracteres',
    'any.required': 'El nombre es requerido',
  }),
  avatar_url: Joi.string().allow('', null).pattern(imageUrlPattern).messages({
    'string.pattern.base': 'La URL del avatar debe ser una imagen JPG o PNG válida',
  }),
  bio: Joi.string().max(500).allow('', null).messages({
    'string.max': 'La biografía no debe exceder los 500 caracteres',
  }),
});

export const createWorkerProfileSchema = Joi.object({
  full_name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'El nombre no puede estar vacío',
    'string.min': 'El nombre debe tener al menos 1 caracter',
    'string.max': 'El nombre no debe exceder los 100 caracteres',
    'any.required': 'El nombre es requerido',
  }),
  avatar_url: Joi.string().allow('', null).pattern(imageUrlPattern).messages({
    'string.pattern.base': 'La URL del avatar debe ser una imagen JPG o PNG válida',
  }),
  bio: Joi.string().max(500).allow('', null).messages({
    'string.max': 'La biografía no debe exceder los 500 caracteres',
  }),
  category_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'La categoría debe ser un UUID válido',
    'any.required': 'La categoría es requerida',
  }),
  hourly_rate: Joi.number().positive().precision(2).required().messages({
    'number.base': 'La tarifa por hora debe ser un número',
    'number.positive': 'La tarifa por hora debe ser un valor positivo',
    'any.required': 'La tarifa por hora es requerida',
  }),
  availability_status: Joi.string()
    .valid('AVAILABLE', 'BUSY', 'OFFLINE')
    .default('AVAILABLE')
    .messages({
      'any.only': 'El estado de disponibilidad debe ser AVAILABLE, BUSY u OFFLINE',
    }),
});

export const switchRoleSchema = Joi.object({
  role: Joi.string().valid('client', 'worker').required().messages({
    'any.only': 'El rol debe ser client o worker',
    'any.required': 'El rol es requerido',
  }),
});

export const updateWorkerProfileSchema = Joi.object({
  full_name: Joi.string().min(1).max(100).messages({
    'string.empty': 'El nombre no puede estar vacío',
    'string.min': 'El nombre debe tener al menos 1 caracter',
    'string.max': 'El nombre no debe exceder los 100 caracteres',
  }),
  avatar_url: Joi.string().allow('', null).pattern(imageUrlPattern).messages({
    'string.pattern.base': 'La URL del avatar debe ser una imagen JPG o PNG válida',
  }),
  bio: Joi.string().max(500).allow('', null).messages({
    'string.max': 'La biografía no debe exceder los 500 caracteres',
  }),
  category_id: Joi.string().pattern(uuidPattern).messages({
    'string.pattern.base': 'La categoría debe ser un UUID válido',
  }),
  hourly_rate: Joi.number().positive().precision(2).messages({
    'number.base': 'La tarifa por hora debe ser un número',
    'number.positive': 'La tarifa por hora debe ser un valor positivo',
  }),
  availability_status: Joi.string().valid('AVAILABLE', 'BUSY', 'OFFLINE').messages({
    'any.only': 'El estado de disponibilidad debe ser AVAILABLE, BUSY u OFFLINE',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar',
  });

export const createLocationSchema = Joi.object({
  address: Joi.string().min(3).max(255).required().messages({
    'string.empty': 'La dirección no puede estar vacía',
    'string.min': 'La dirección debe tener al menos 3 caracteres',
    'string.max': 'La dirección no debe exceder los 255 caracteres',
    'any.required': 'La dirección es requerida',
  }),
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.base': 'La latitud debe ser un número',
    'number.min': 'La latitud debe estar entre -90 y 90',
    'number.max': 'La latitud debe estar entre -90 y 90',
    'any.required': 'La latitud es requerida',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.base': 'La longitud debe ser un número',
    'number.min': 'La longitud debe estar entre -180 y 180',
    'number.max': 'La longitud debe estar entre -180 y 180',
    'any.required': 'La longitud es requerida',
  }),
  is_primary: Joi.boolean().messages({
    'boolean.base': 'is_primary debe ser un booleano',
  }),
});

export const updateLocationSchema = Joi.object({
  address: Joi.string().min(3).max(255).messages({
    'string.empty': 'La dirección no puede estar vacía',
    'string.min': 'La dirección debe tener al menos 3 caracteres',
    'string.max': 'La dirección no debe exceder los 255 caracteres',
  }),
  latitude: Joi.number().min(-90).max(90).messages({
    'number.base': 'La latitud debe ser un número',
    'number.min': 'La latitud debe estar entre -90 y 90',
    'number.max': 'La latitud debe estar entre -90 y 90',
  }),
  longitude: Joi.number().min(-180).max(180).messages({
    'number.base': 'La longitud debe ser un número',
    'number.min': 'La longitud debe estar entre -180 y 180',
    'number.max': 'La longitud debe estar entre -180 y 180',
  }),
  is_primary: Joi.boolean().messages({
    'boolean.base': 'is_primary debe ser un booleano',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar',
  });

export const listLocationsQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).messages({
    'number.base': 'lat debe ser un número',
    'number.min': 'lat debe estar entre -90 y 90',
    'number.max': 'lat debe estar entre -90 y 90',
  }),
  lng: Joi.number().min(-180).max(180).messages({
    'number.base': 'lng debe ser un número',
    'number.min': 'lng debe estar entre -180 y 180',
    'number.max': 'lng debe estar entre -180 y 180',
  }),
})
  .with('lat', 'lng')
  .with('lng', 'lat');

export const createChatSchema = Joi.object({
  user_id_2: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'user_id_2 debe ser un UUID válido',
    'any.required': 'user_id_2 es requerido',
  }),
  order_id: Joi.string().pattern(uuidPattern).allow(null).messages({
    'string.pattern.base': 'order_id debe ser un UUID válido',
  }),
});

export const listChatsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
  status: Joi.string().valid('all', 'favorites', 'active', 'archived').messages({
    'any.only': 'status debe ser all, favorites, active o archived',
  }),
  search: Joi.string().trim().max(100).messages({
    'string.base': 'search debe ser un texto',
    'string.max': 'search no debe exceder los 100 caracteres',
  }),
});

export const createMessageSchema = Joi.object({
  message_type: Joi.string().valid('TEXT', 'IMAGE', 'QUOTE').default('TEXT').messages({
    'any.only': 'message_type debe ser TEXT, IMAGE o QUOTE',
  }),
  content: Joi.string().max(5000).allow(null, '').messages({
    'string.base': 'content debe ser un texto',
    'string.max': 'content no debe exceder los 5000 caracteres',
  }),
}).custom((value, helpers) => {
  if (value.message_type !== 'IMAGE' && !value.content) {
    return helpers.message(`content es requerido para mensajes de tipo ${value.message_type}`);
  }
  return value;
});

export const listMessagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
});

export const nearbyWorkersQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.base': 'latitude debe ser un número',
    'number.min': 'latitude debe estar entre -90 y 90',
    'number.max': 'latitude debe estar entre -90 y 90',
    'any.required': 'latitude es requerida',
  }),
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.base': 'longitude debe ser un número',
    'number.min': 'longitude debe estar entre -180 y 180',
    'number.max': 'longitude debe estar entre -180 y 180',
    'any.required': 'longitude es requerida',
  }),
  radius_km: Joi.number().min(1).max(100).required().messages({
    'number.base': 'radius_km debe ser un número',
    'number.min': 'radius_km debe ser al menos 1 km',
    'number.max': 'radius_km no debe exceder los 100 km',
    'any.required': 'radius_km es requerido',
  }),
  category_id: Joi.string().pattern(uuidPattern).messages({
    'string.pattern.base': 'category_id debe ser un UUID válido',
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
});

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const createQuoteSchema = Joi.object({
  proposed_price: Joi.number().positive().precision(2).max(99999999.99).required().messages({
    'number.base': 'El precio propuesto debe ser un número',
    'number.positive': 'El precio propuesto debe ser un valor positivo',
    'number.max': 'El precio propuesto no debe exceder los 99,999,999.99',
    'any.required': 'El precio propuesto es requerido',
  }),
  proposed_date: Joi.date()
    .iso()
    .custom((value, helpers) => {
      // Joi interpreta 'YYYY-MM-DD' como medianoche UTC; comparamos fechas de
      // calendario para no rechazar el día de hoy en zonas horarias detrás de UTC.
      const today = new Date();
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');
      if (value.toISOString().slice(0, 10) < todayStr) {
        return helpers.message('La fecha propuesta debe ser hoy o una fecha futura');
      }
      return value;
    })
    .required()
    .messages({
      'date.base': 'La fecha propuesta debe ser una fecha válida',
      'date.iso': 'La fecha propuesta debe tener formato ISO (YYYY-MM-DD)',
      'any.required': 'La fecha propuesta es requerida',
    }),
  proposed_time: Joi.string().pattern(timePattern).required().messages({
    'string.pattern.base': 'La hora propuesta debe tener formato HH:mm',
    'any.required': 'La hora propuesta es requerida',
  }),
});

export const updateQuoteStatusSchema = Joi.object({
  status: Joi.string().valid('ACCEPTED', 'REJECTED', 'CANCELLED').required().messages({
    'any.only': 'El estado solo puede cambiarse a ACCEPTED, REJECTED o CANCELLED',
    'any.required': 'El estado es requerido',
  }),
  rejection_reason: Joi.string().trim().max(1000).allow('', null).messages({
    'string.max': 'El motivo no debe exceder los 1000 caracteres',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar',
  });

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED')
    .required()
    .messages({
      'any.only':
        'El estado debe ser uno de: ACCEPTED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED',
      'any.required': 'El estado es requerido',
    }),
});

const luhnCheck = (val) => {
  let sum = 0;
  let shouldDouble = false;
  for (let i = val.length - 1; i >= 0; i--) {
    let digit = parseInt(val.charAt(i), 10);
    if (shouldDouble) {
      if ((digit *= 2) > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

export const createPaymentMethodSchema = Joi.object({
  card_number: Joi.string()
    .trim()
    .pattern(/^\d{13,19}$/)
    .required()
    .custom((value, helpers) => {
      if (!luhnCheck(value)) {
        return helpers.message('El número de tarjeta no es válido (Fallo en verificación Luhn)');
      }
      return value;
    })
    .messages({
      'string.pattern.base': 'El número de tarjeta debe contener entre 13 y 19 dígitos numéricos',
      'any.required': 'El número de tarjeta es requerido',
    }),
  cvv: Joi.string()
    .trim()
    .pattern(/^\d{3,4}$/)
    .required()
    .messages({
      'string.pattern.base': 'El CVV debe tener 3 o 4 dígitos',
      'any.required': 'El CVV es requerido',
    }),
  exp_month: Joi.number().integer().min(1).max(12).required().messages({
    'number.base': 'El mes de expiración debe ser un número',
    'number.min': 'El mes de expiración debe estar entre 1 y 12',
    'number.max': 'El mes de expiración debe estar entre 1 y 12',
    'any.required': 'El mes de expiración es requerido',
  }),
  exp_year: Joi.number()
    .integer()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 20)
    .required()
    .messages({
      'number.base': 'El año de expiración debe ser un número',
      'number.min': 'El año de expiración no puede ser en el pasado',
      'any.required': 'El año de expiración es requerido',
    }),
  cardholder_name: Joi.string().trim().min(3).max(150).required().messages({
    'string.empty': 'El nombre del titular no puede estar vacío',
    'string.min': 'El nombre del titular debe tener al menos 3 caracteres',
    'string.max': 'El nombre del titular no debe exceder los 150 caracteres',
    'any.required': 'El nombre del titular es requerido',
  }),
  is_primary: Joi.boolean().default(false).messages({
    'boolean.base': 'is_primary debe ser un booleano',
  }),
}).custom((value, helpers) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (value.exp_year === currentYear && value.exp_month < currentMonth) {
    return helpers.message('La tarjeta de pago ya ha expirado');
  }
  return value;
});

export const updatePaymentMethodSchema = Joi.object({
  exp_month: Joi.number().integer().min(1).max(12).optional().messages({
    'number.min': 'El mes de expiración debe estar entre 1 y 12',
    'number.max': 'El mes de expiración debe estar entre 1 y 12',
  }),
  exp_year: Joi.number()
    .integer()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 20)
    .optional()
    .messages({
      'number.min': 'El año de expiración no puede ser en el pasado',
    }),
  cardholder_name: Joi.string().trim().min(3).max(150).optional().messages({
    'string.empty': 'El nombre del titular no puede estar vacío',
    'string.min': 'El nombre del titular debe tener al menos 3 caracteres',
    'string.max': 'El nombre del titular no debe exceder los 150 caracteres',
  }),
  is_primary: Joi.boolean().optional().messages({
    'boolean.base': 'is_primary debe ser un booleano',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar',
  });

export const processPaymentSchema = Joi.object({
  order_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'El ID de la orden debe ser un UUID válido',
    'any.required': 'El ID de la orden es requerido',
  }),
  payment_method_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'El ID del método de pago debe ser un UUID válido',
    'any.required': 'El ID del método de pago es requerido',
  }),
  amount: Joi.number().positive().required().messages({
    'number.base': 'El monto debe ser un número',
    'number.positive': 'El monto debe ser un valor positivo',
    'any.required': 'El monto es requerido',
  }),
});

export const createCertificationSchema = Joi.object({
  document_type: Joi.string()
    .valid('BACKGROUND_CHECK', 'ID_VERIFICATION', 'PROFESSIONAL_LICENSE')
    .required()
    .messages({
      'any.only':
        'El tipo de documento debe ser BACKGROUND_CHECK, ID_VERIFICATION o PROFESSIONAL_LICENSE',
      'any.required': 'El tipo de documento es requerido',
    }),
});

export const updateCertificationStatusSchema = Joi.object({
  verification_status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').required().messages({
    'any.only': 'El estado debe ser PENDING, APPROVED o REJECTED',
    'any.required': 'El estado de verificación es requerido',
  }),
  rejected_reason: Joi.string()
    .trim()
    .min(5)
    .max(1000)
    .when('verification_status', {
      is: 'REJECTED',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ''),
    })
    .messages({
      'any.required': 'Debe proporcionar un motivo para rechazar la certificación',
      'string.min': 'El motivo del rechazo debe tener al menos 5 caracteres',
      'string.max': 'El motivo del rechazo no debe exceder los 1000 caracteres',
    }),
});

export const createOrderSchema = Joi.object({
  client_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'client_id debe ser un UUID válido',
    'any.required': 'client_id es requerido',
  }),
  worker_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'worker_id debe ser un UUID válido',
    'any.required': 'worker_id es requerido',
  }),
  category_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'category_id debe ser un UUID válido',
    'any.required': 'category_id es requerido',
  }),
  location_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'location_id debe ser un UUID válido',
    'any.required': 'location_id es requerido',
  }),
  description: Joi.string().max(2000).allow('', null).messages({
    'string.max': 'La descripción no debe exceder los 2000 caracteres',
  }),
}).custom((value, helpers) => {
  if (value.client_id === value.worker_id) {
    return helpers.message('El cliente y el trabajador no pueden ser el mismo usuario');
  }
  return value;
});

export const listUserOrdersQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
  status: Joi.string()
    .valid('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED')
    .messages({
      'any.only':
        'El estado debe ser uno de: PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED',
    }),
  role: Joi.string().valid('MINE_AS_CLIENT', 'MINE_AS_WORKER').messages({
    'any.only': 'El rol debe ser MINE_AS_CLIENT o MINE_AS_WORKER',
  }),
  date_from: Joi.date().iso().messages({
    'date.base': 'date_from debe ser una fecha válida',
    'date.iso': 'date_from debe tener formato ISO (YYYY-MM-DD)',
  }),
  date_to: Joi.date().iso().messages({
    'date.base': 'date_to debe ser una fecha válida',
    'date.iso': 'date_to debe tener formato ISO (YYYY-MM-DD)',
  }),
});

export const completeOrderSchema = Joi.object({
  // Opcional: confirmación explícita del cliente o trabajador
  // Si se omite, se asume que quien llama confirma
  confirm: Joi.boolean().default(true).messages({
    'boolean.base': 'confirm debe ser un valor booleano',
  }),
});

// ── Rating schemas ──────────────────────────────────────────────────────────────

export const createRatingSchema = Joi.object({
  order_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'order_id debe ser un UUID válido',
    'any.required': 'order_id es requerido',
  }),
  rating_stars: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'rating_stars debe ser un número',
    'number.integer': 'rating_stars debe ser un número entero',
    'number.min': 'rating_stars debe ser al menos 1',
    'number.max': 'rating_stars no debe exceder 5',
    'any.required': 'rating_stars es requerido',
  }),
  review_text: Joi.string().trim().max(1000).allow('', null).messages({
    'string.max': 'review_text no debe exceder los 1000 caracteres',
  }),
});

export const listRatingsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
});

// ── Dispute schemas ─────────────────────────────────────────────────────────────

export const createDisputeSchema = Joi.object({
  order_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'order_id debe ser un UUID válido',
    'any.required': 'order_id es requerido',
  }),
  reason: Joi.string().trim().min(10).max(2000).required().messages({
    'string.empty': 'La razón no puede estar vacía',
    'string.min': 'La razón debe tener al menos 10 caracteres',
    'string.max': 'La razón no debe exceder los 2000 caracteres',
    'any.required': 'La razón es requerida',
  }),
  evidence_url: Joi.string().trim().uri().allow('', null).messages({
    'string.uri': 'La URL de evidencia debe ser un enlace válido',
  }),
});

export const listDisputesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit debe ser un número entero',
    'number.min': 'limit debe ser al menos 1',
    'number.max': 'limit no debe exceder 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'offset debe ser un número entero',
    'number.min': 'offset no puede ser negativo',
  }),
});

export const resolveDisputeSchema = Joi.object({
  status: Joi.string().valid('RESOLVED', 'CLOSED').required().messages({
    'any.only': 'El estado debe ser RESOLVED o CLOSED',
    'any.required': 'El estado es requerido',
  }),
  resolution_notes: Joi.string().trim().min(10).max(2000).required().messages({
    'string.empty': 'Las notas de resolución no pueden estar vacías',
    'string.min': 'Las notas de resolución deben tener al menos 10 caracteres',
    'string.max': 'Las notas de resolución no deben exceder los 2000 caracteres',
    'any.required': 'Las notas de resolución son requeridas',
  }),
  winner: Joi.string().valid('client', 'worker').when('status', {
    is: 'RESOLVED',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }).messages({
    'any.only': 'El ganador debe ser client o worker',
    'any.required': 'El ganador es requerido cuando el estado es RESOLVED',
  }),
});

