const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
//const emailService = require('../utils/emailService');

// Middleware de validación para registro
const validateRegister = [
  body('nombre')
    .notEmpty().withMessage('El nombre es requerido')
    .trim()
    .escape(),
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/\d/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una mayúscula'),
  body('tipo_usuario')
    .isIn(['emprendedor', 'inversor']).withMessage('Tipo de usuario inválido')
];

// Middleware de validación para login
const validateLogin = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
];

// REGISTRO DE USUARIO
router.post('/register', validateRegister, async (req, res) => {
  try {
    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { nombre, email, password, tipo_usuario, biografia, pais } = req.body;
    
    // Verificar si el email ya existe
    const emailExists = await User.emailExists(email);
    if (emailExists) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    // Crear usuario
    const user = await User.create({
      nombre,
      email,
      password,
      tipo_usuario,
      biografia,
      pais
    });
    
    // Generar token JWT
    const token = User.generateToken(user);
    
    // Actualizar último login
    await User.updateLastLogin(user.id);
    
    // Enviar email de bienvenida (en segundo plano)
    //try {
    //  emailService.sendWelcomeEmail(user);
    //} catch (emailError) {
    //  console.error('Error enviando email de bienvenida:', emailError);
      // No fallar el registro por error en email
    //}
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo_usuario: user.tipo_usuario,
        saldo: user.saldo,
        fecha_registro: user.fecha_registro
      }
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Error en el servidor' 
        : error.message
    });
  }
});

// LOGIN DE USUARIO
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    
    // Buscar usuario
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }
    
    // Verificar contraseña
    const isValidPassword = await User.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }
    
    // Verificar si el usuario está activo
    if (user.estado !== 'activo') {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta no está activa'
      });
    }
    
    // Generar token JWT
    const token = User.generateToken(user);
    
    // Actualizar último login
    await User.updateLastLogin(user.id);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo_usuario: user.tipo_usuario,
        saldo: user.saldo,
        avatar_url: user.avatar_url,
        biografia: user.biografia
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Error en el servidor' 
        : error.message
    });
  }
});

// VERIFICAR TOKEN (para mantener sesión activa)
router.post('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }
    
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    // Buscar usuario actualizado
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Generar nuevo token (refresh)
    const newToken = User.generateToken(user);
    
    res.json({
      success: true,
      token: newToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo_usuario: user.tipo_usuario,
        saldo: user.saldo,
        avatar_url: user.avatar_url
      }
    });
    
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    });
  }
});

// OBTENER PERFIL DE USUARIO (requiere autenticación)
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }
    
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Obtener estadísticas del usuario
    const stats = await User.getUserStats(user.id, user.tipo_usuario);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tipo_usuario: user.tipo_usuario,
        saldo: user.saldo,
        avatar_url: user.avatar_url,
        biografia: user.biografia,
        telefono: user.telefono,
        pais: user.pais,
        fecha_registro: user.fecha_registro
      },
      stats
    });
    
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    });
  }
});

// ACTUALIZAR PERFIL
router.put('/profile', [
  body('nombre').optional().trim().escape(),
  body('biografia').optional().trim().escape(),
  body('telefono').optional().trim().escape(),
  body('pais').optional().trim().escape()
], async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }
    
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const result = await User.updateProfile(decoded.id, req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: result.user
    });
    
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    });
  }
});

// RECARGAR SALDO (solo para inversores)
router.post('/recharge', [
  body('monto')
    .isFloat({ min: 1, max: 10000 }).withMessage('Monto debe estar entre 1 y 10000')
], async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }
    
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { monto } = req.body;
    
    const result = await User.rechargeBalance(decoded.id, parseFloat(monto));
    
    res.json({
      success: true,
      message: 'Saldo recargado exitosamente',
      nuevo_saldo: result.newBalance
    });
    
  } catch (error) {
    console.error('Error recargando saldo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error en el servidor'
    });
  }
});

module.exports = router;