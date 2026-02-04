const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { initDatabase } = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const dashboardRoutes = require('./routes/dashboard');
const statsRoutes = require('./routes/stats');

// Importar middleware de mantenimiento
require('./utils/maintenance');

const app = express();

// Inicializar base de datos
initDatabase();

// Middlewares de seguridad y performance
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar para desarrollo, ajustar para producción
}));
app.use(compression());
app.use(cors({
  origin: function(origin, callback) {
    // Permitir todos los orígenes en desarrollo
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, permitir solo dominios específicos
    const allowedOrigins = [
      'https://crowdfunding-app.onrender.com',
      'https://crowdfunding-app-qkjm.onrender.com', // Cambia esto por tu dominio
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint (crítico para Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'crowdfunding-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta para verificar la API
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API de Crowdfunding funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Ruta catch-all para SPA (Single Page Application)
app.get('*', (req, res) => {
  // Si es una ruta de API, devolver 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Ruta API no encontrada'
    });
  }
  
  // Para cualquier otra ruta, servir el index.html del frontend
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Algo salió mal en el servidor' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`
  🚀 Servidor Crowdfunding iniciado
  📍 Host: ${HOST}
  🔌 Puerto: ${PORT}
  🌐 Entorno: ${process.env.NODE_ENV || 'development'}
  ⏰ Hora: ${new Date().toLocaleString()}
  `);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Aplicación lista en la nube');
  } else {
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api/status`);
  }
});

module.exports = app;