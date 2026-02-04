const { Pool } = require('pg');

// Configuración del pool de conexiones
let pool;

async function initDatabase() {
  try {
    // Crear pool de conexiones
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      max: 20, // máximo de conexiones en el pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Probar conexión
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL en la nube');
    
    // Crear tablas si no existen
    await createTables(client);
    
    client.release();
    
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    
    // En producción, reintentar después de 5 segundos
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Reintentando conexión en 5 segundos...');
      setTimeout(initDatabase, 5000);
    } else {
      throw error;
    }
  }
}

async function createTables(client) {
  try {
    // Tabla de usuarios
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
        last_login TIMESTAMP,
        
        -- Índices para mejor performance
        CONSTRAINT chk_saldo_positivo CHECK (saldo >= 0)
      )
    `);
    console.log('✅ Tabla usuarios creada/verificada');

    // Tabla de proyectos
    await client.query(`
      CREATE TABLE IF NOT EXISTS proyectos (
        id SERIAL PRIMARY KEY,
        id_emprendedor INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        titulo VARCHAR(200) NOT NULL,
        descripcion TEXT,
        meta_financiera DECIMAL(10,2) NOT NULL CHECK (meta_financiera > 0),
        fondos_recaudados DECIMAL(10,2) DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_limite DATE NOT NULL,
        estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'completado', 'expirado', 'cancelado')),
        categoria VARCHAR(50),
        imagen_url VARCHAR(500) DEFAULT 'default-project.jpg',
        video_url VARCHAR(500),
        tags VARCHAR(500),
        updates_count INTEGER DEFAULT 0,
        investors_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        
        -- Índices
        INDEX idx_proyectos_estado (estado),
        INDEX idx_proyectos_categoria (categoria),
        INDEX idx_proyectos_fecha_limite (fecha_limite),
        
        CONSTRAINT chk_fondos_positivos CHECK (fondos_recaudados >= 0),
        CONSTRAINT chk_fecha_futura CHECK (fecha_limite > CURRENT_DATE)
      )
    `);
    console.log('✅ Tabla proyectos creada/verificada');

    // Tabla de inversiones
    await client.query(`
      CREATE TABLE IF NOT EXISTS inversiones (
        id SERIAL PRIMARY KEY,
        id_proyecto INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
        id_inversor INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
        fecha_inversion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'reembolsada')),
        transaccion_id VARCHAR(100),
        nota VARCHAR(500),
        
        -- Índices
        INDEX idx_inversiones_usuario (id_inversor),
        INDEX idx_inversiones_proyecto (id_proyecto),
        INDEX idx_inversiones_fecha (fecha_inversion),
        
        -- Restricción única: un inversor solo puede invertir una vez por proyecto
        CONSTRAINT unique_inversion UNIQUE (id_proyecto, id_inversor)
      )
    `);
    console.log('✅ Tabla inversiones creada/verificada');

    // Tabla de actualizaciones de proyectos
    await client.query(`
      CREATE TABLE IF NOT EXISTS actualizaciones (
        id SERIAL PRIMARY KEY,
        id_proyecto INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
        titulo VARCHAR(200) NOT NULL,
        contenido TEXT NOT NULL,
        fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo VARCHAR(20) DEFAULT 'update',
        
        INDEX idx_actualizaciones_proyecto (id_proyecto)
      )
    `);
    console.log('✅ Tabla actualizaciones creada/verificada');

    // Tabla de comentarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        id_proyecto INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
        id_usuario INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        contenido TEXT NOT NULL,
        fecha_comentario TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        
        INDEX idx_comentarios_proyecto (id_proyecto),
        INDEX idx_comentarios_usuario (id_usuario)
      )
    `);
    console.log('✅ Tabla comentarios creada/verificada');

    // Insertar datos de ejemplo si está vacío (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      await seedDatabase(client);
    }

  } catch (error) {
    // Ignorar error si las tablas ya existen (código 42P07 en PostgreSQL)
    if (error.code !== '42P07') {
      console.error('❌ Error creando tablas:', error.message);
      throw error;
    }
  }
}

async function seedDatabase(client) {
  try {
    // Verificar si ya hay datos
    const result = await client.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(result.rows[0].count) > 0) {
      console.log('📊 Base de datos ya tiene datos, omitiendo seed');
      return;
    }

    console.log('🌱 Insertando datos de ejemplo...');

    // Insertar usuarios de ejemplo
    await client.query(`
      INSERT INTO usuarios (nombre, email, password, tipo_usuario, saldo, biografia) VALUES
      ('Juan Pérez', 'juan@ejemplo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3.7ZR8bZzB2K0UwJ7vT4J1J1ZzC', 'emprendedor', 0, 'Apasionado por la tecnología y el emprendimiento'),
      ('María García', 'maria@ejemplo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3.7ZR8bZzB2K0UwJ7vT4J1J1ZzC', 'inversor', 5000, 'Inversora ángel con experiencia en startups'),
      ('Carlos López', 'carlos@ejemplo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3.7ZR8bZzB2K0UwJ7vT4J1J1ZzC', 'emprendedor', 0, 'Ingeniero desarrollando soluciones sostenibles'),
      ('Ana Martínez', 'ana@ejemplo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3.7ZR8bZzB2K0UwJ7vT4J1J1ZzC', 'inversor', 10000, 'Especialista en fintech y blockchain')
    `);

    // Insertar proyectos de ejemplo
    await client.query(`
      INSERT INTO proyectos (id_emprendedor, titulo, descripcion, meta_financiera, fondos_recaudados, fecha_limite, estado, categoria) VALUES
      (1, 'App de Reciclaje Inteligente', 'Aplicación que recompensa por reciclar correctamente usando IA para identificar materiales', 15000, 8500, CURRENT_DATE + 45, 'activo', 'tecnologia'),
      (1, 'Dron de Rescate Solar', 'Dron autónomo con paneles solares para búsqueda y rescate en zonas remotas', 25000, 12000, CURRENT_DATE + 30, 'activo', 'ecologia'),
      (3, 'Plataforma de Educación Online', 'Sistema de aprendizaje adaptativo para estudiantes de primaria', 8000, 8000, CURRENT_DATE - 5, 'completado', 'educacion'),
      (3, 'Kit de Jardín Hidropónico', 'Kit completo para cultivar vegetales en casa sin tierra', 5000, 3000, CURRENT_DATE + 15, 'activo', 'ecologia')
    `);

    // Insertar inversiones de ejemplo
    await client.query(`
      INSERT INTO inversiones (id_proyecto, id_inversor, monto, estado) VALUES
      (1, 2, 2000, 'activa'),
      (1, 4, 3000, 'activa'),
      (2, 2, 5000, 'activa'),
      (3, 4, 4000, 'completada'),
      (4, 2, 1500, 'activa')
    `);

    console.log('✅ Datos de ejemplo insertados');
  } catch (error) {
    console.error('❌ Error insertando datos de ejemplo:', error.message);
  }
}

// Función para obtener conexión
async function getConnection() {
  if (!pool) {
    await initDatabase();
  }
  return await pool.connect();
}

// Función para ejecutar queries simples
async function query(text, params) {
  if (!pool) {
    await initDatabase();
  }
  
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query ejecutada:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    throw error;
  }
}

// Función para monitoreo de salud
async function checkDatabaseHealth() {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
      database_time: result.rows[0].time,
      version: result.rows[0].version.split(' ')[1]
    };
  } catch (error) {
    return {
      healthy: false,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

module.exports = {
  initDatabase,
  getConnection,
  query,
  checkDatabaseHealth,
  pool: () => pool
};