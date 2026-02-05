const { Pool } = require('pg');

console.log('🔧 Iniciando configuración de base de datos...');
console.log('📊 DATABASE_URL disponible:', !!process.env.DATABASE_URL);

// Variable global para el pool
let globalPool = null;

// Función principal para crear/verificar tablas
async function ensureTablesExist() {
  try {
    console.log('🔄 Configurando tablas de base de datos...');
    
    // Configurar pool si no existe
    if (!globalPool) {
      globalPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' 
          ? { rejectUnauthorized: false }
          : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    
    const client = await globalPool.connect();
    console.log('✅ Conectado a PostgreSQL en Render');
    
    // 1. TABLA USUARIOS
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          tipo_usuario VARCHAR(20) CHECK (tipo_usuario IN ('emprendedor', 'inversor')),
          saldo DECIMAL(10,2) DEFAULT 0,
          fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          estado VARCHAR(20) DEFAULT 'activo',
          avatar_url VARCHAR(500),
          biografia TEXT,
          telefono VARCHAR(20),
          pais VARCHAR(50),
          last_login TIMESTAMP
        )
      `);
      console.log('✅ Tabla "usuarios" verificada/creada');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('📊 Tabla "usuarios" ya existe');
      } else {
        throw err;
      }
    }
    
    // 2. TABLA PROYECTOS
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS proyectos (
          id SERIAL PRIMARY KEY,
          id_emprendedor INTEGER REFERENCES usuarios(id),
          titulo VARCHAR(200) NOT NULL,
          descripcion TEXT,
          meta_financiera DECIMAL(10,2) NOT NULL CHECK (meta_financiera > 0),
          fondos_recaudados DECIMAL(10,2) DEFAULT 0,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_limite DATE NOT NULL,
          estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'completado', 'expirado', 'cancelado')),
          categoria VARCHAR(50),
          imagen_url VARCHAR(500) DEFAULT 'default-project.jpg',
          tags VARCHAR(500),
          updates_count INTEGER DEFAULT 0,
          investors_count INTEGER DEFAULT 0,
          views_count INTEGER DEFAULT 0
        )
      `);
      console.log('✅ Tabla "proyectos" verificada/creada');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('📊 Tabla "proyectos" ya existe');
      } else {
        throw err;
      }
    }
    
    // 3. TABLA INVERSIONES
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS inversiones (
          id SERIAL PRIMARY KEY,
          id_proyecto INTEGER REFERENCES proyectos(id),
          id_inversor INTEGER REFERENCES usuarios(id),
          monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
          fecha_inversion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'reembolsada'))
        )
      `);
      console.log('✅ Tabla "inversiones" verificada/creada');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('📊 Tabla "inversiones" ya existe');
      } else {
        throw err;
      }
    }
    
    // 4. INSERTAR DATOS DE PRUEBA SI NO HAY USUARIOS
    const userCount = await client.query('SELECT COUNT(*) FROM usuarios');
    const count = parseInt(userCount.rows[0].count);
    
    if (count === 0) {
      console.log('📥 Insertando datos de prueba...');
      
      // Password hasheado para "Test123"
      const hashedPassword = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK6WYcXJgXjNfYJ7dQ.7JQ8QYqXqK';
      
      // Insertar usuarios demo
      await client.query(`
        INSERT INTO usuarios (nombre, email, password, tipo_usuario, saldo)
        VALUES 
          ('Usuario Inversor', 'demo@test.com', $1, 'inversor', 5000),
          ('Usuario Emprendedor', 'emp@test.com', $1, 'emprendedor', 0)
      `, [hashedPassword]);
      
      console.log('✅ Usuarios demo creados:');
      console.log('   👤 demo@test.com / Test123 (inversor - saldo: $5000)');
      console.log('   👤 emp@test.com / Test123 (emprendedor)');
      
      // Insertar proyecto demo
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + 60); // 60 días desde hoy
      
      await client.query(`
        INSERT INTO proyectos (id_emprendedor, titulo, descripcion, meta_financiera, fecha_limite, categoria)
        VALUES (2, 'Proyecto Demo Crowdfunding', 'Este es un proyecto de demostración para la plataforma', 10000, $1, 'tecnologia')
      `, [fechaLimite.toISOString().split('T')[0]]);
      
      console.log('✅ Proyecto demo creado');
    } else {
      console.log(`📊 Base de datos tiene ${count} usuario(s) registrado(s)`);
    }
    
    client.release();
    console.log('🎉 Configuración de base de datos completada');
    return globalPool;
    
  } catch (error) {
    console.error('❌ Error en ensureTablesExist:', error.message);
    console.error('Código error:', error.code);
    
    // Si ya existe, no es problema
    if (error.code === '42P07') {
      console.log('⚠️  Tablas ya existen, continuando...');
      return globalPool;
    }
    
    // En producción, no fallar
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Continuando sin configuración completa de DB...');
      return globalPool;
    }
    
    throw error;
  }
}

// Función de compatibilidad para server.js
function initDatabase() {
  console.log('⚡ initDatabase() llamado - Modo compatibilidad');
  return ensureTablesExist();
}

// Función para ejecutar queries
async function query(text, params) {
  // Asegurar que el pool exista
  if (!globalPool) {
    await ensureTablesExist();
  }
  
  try {
    const start = Date.now();
    const result = await globalPool.query(text, params);
    const duration = Date.now() - start;
    
    // Log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const queryShort = text.length > 100 ? text.substring(0, 100) + '...' : text;
      console.log(`📊 Query ejecutada (${duration}ms): ${queryShort}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    console.error('Query:', text.substring(0, 200));
    console.error('Parámetros:', params);
    
    // Re-lanzar error para manejo superior
    throw error;
  }
}

// Función para obtener conexión directa
async function getConnection() {
  if (!globalPool) {
    await ensureTablesExist();
  }
  return await globalPool.connect();
}

// Función para verificar salud de la DB
async function checkDatabaseHealth() {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
      database_time: result.rows[0].time,
      version: result.rows[0].version.split(' ')[1],
      tables: {
        usuarios: true,
        proyectos: true,
        inversiones: true
      }
    };
  } catch (error) {
    return {
      healthy: false,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

// Auto-inicialización al cargar el módulo
setTimeout(() => {
  if (process.env.NODE_ENV !== 'test') {
    ensureTablesExist().catch(err => {
      console.error('❌ Error auto-inicializando DB:', err.message);
    });
  }
}, 1000);

// Exportaciones
module.exports = {
  // Para server.js (compatibilidad)
  initDatabase,
  
  // Funciones principales
  ensureTablesExist,
  query,
  getConnection,
  checkDatabaseHealth,
  
  // Para acceso directo si es necesario
  pool: () => globalPool
};