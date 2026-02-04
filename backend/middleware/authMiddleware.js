const User = require('../models/User');

// Middleware para verificar autenticación
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acceso no autorizado. Token requerido.' 
      });
    }

    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }
    
    // Verificar que el usuario aún existe y está activo
    const user = await User.findById(decoded.id);
    if (!user || user.estado !== 'activo') {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no encontrado o inactivo' 
      });
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      tipo_usuario: user.tipo_usuario,
      nombre: user.nombre
    };
    
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expirado. Por favor inicia sesión nuevamente.' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido. Acceso denegado.' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Error en el servidor de autenticación' 
    });
  }
};

// Middleware para verificar rol específico
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      });
    }

    if (!roles.includes(req.user.tipo_usuario)) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permisos para realizar esta acción' 
      });
    }

    next();
  };
};

// Middleware para logging de auditoría
const auditLog = (action) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const originalUrl = req.originalUrl;
    const method = req.method;
    const userId = req.user?.id || 'guest';
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress;
    
    // Interceptar la respuesta para registrar después
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Registrar la acción (en producción, guardar en base de datos)
      console.log(`[AUDIT] ${new Date().toISOString()} | ${method} ${originalUrl} | User: ${userId} | IP: ${ip} | Status: ${statusCode} | Duration: ${duration}ms | Action: ${action}`);
      
      // Aquí podrías guardar en una tabla de logs:
      // await saveAuditLog({ userId, action, method, url: originalUrl, statusCode, duration, userAgent, ip });
      
      originalSend.apply(res, arguments);
    };
    
    next();
  };
};

// Guardar log de auditoría en base de datos (función de ejemplo)
async function saveAuditLog(logData) {
  try {
    const { query } = require('../config/database');
    await query(
      `INSERT INTO audit_logs 
       (user_id, action, method, url, status_code, duration, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        logData.userId,
        logData.action,
        logData.method,
        logData.url,
        logData.statusCode,
        logData.duration,
        logData.userAgent,
        logData.ip
      ]
    );
  } catch (error) {
    console.error('Error guardando log de auditoría:', error);
  }
}

module.exports = {
  authenticate,
  authorize,
  auditLog
};