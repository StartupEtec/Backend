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
