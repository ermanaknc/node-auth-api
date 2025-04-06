const Joi = require('joi');

// signup
exports.signupSchema = Joi.object({
  email: Joi.string()
    .email()
    .min(5)
    .max(60)
    .required()
    .email({ tlds: { allow: ['com', 'net'] } }),
  password: Joi.string()
    .required()
    .pattern(new RegExp('^[a-zA-Z0-9@#$_!%^&*]+$')),
});

// signin
exports.signinSchema = Joi.object({
  email: Joi.string()
    .email()
    .min(5)
    .max(60)
    .required()
    .email({ tlds: { allow: ['com', 'net'] } }),
  password: Joi.string()
    .required()
    .pattern(new RegExp('^[a-zA-Z0-9@#$_!%^&*]+$')),
});

// accept code
exports.acceptCodeSchema = Joi.object({
  email: Joi.string()
    .email()
    .min(5)
    .max(60)
    .required()
    .email({ tlds: { allow: ['com', 'net'] } }),
  providedCode: Joi.number().required(),
});

// change password
exports.changePasswordSchema = Joi.object({
  newPassword: Joi.string()
    .required()
    .pattern(new RegExp('^[a-zA-Z0-9@#$_!%^&*]+$')),
  oldPassword: Joi.string()
    .required()
    .pattern(new RegExp('^[a-zA-Z0-9@#$_!%^&*]+$')),
});

// accept forgot password code
exports.acceptFPCodeSchema = Joi.object({
  email: Joi.string()
    .email()
    .min(5)
    .max(60)
    .required()
    .email({ tlds: { allow: ['com', 'net'] } }),
  providedCode: Joi.number().required(),
  newPassword: Joi.string()
    .required()
    .pattern(new RegExp('^[a-zA-Z0-9@#$_!%^&*]+$')),
});

// create post
exports.createPostSchema = Joi.object({
  title: Joi.string().required().min(3).max(50),
  description: Joi.string().required().min(10).max(500),
  userId: Joi.string().required(),
});

// update post
exports.updatePostSchema = Joi.object({
  title: Joi.string().min(3).max(50).trim(),
  description: Joi.string().min(10).max(500).trim(),
  userId: Joi.string().required(),
}).min(1); // En az bir alan güncellenmelidir
