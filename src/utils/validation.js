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
