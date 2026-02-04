const { Pool } = require('pg');

let pool;

async function initDatabase() {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL en la nube');
    
    await createTables(client);
    
    client.release();
    
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    
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
        CONSTRAINT unique_inversion UNIQUE (id_proyecto, id_inversor)
      )
    `);
    console.log('✅ Tabla inversiones creada/verificada');

    // Tabla de actualizaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS actualizaciones (
        id SERIAL PRIMARY KEY,
        id_proyecto INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
        titulo VARCHAR(200) NOT NULL,
        contenido TEXT NOT NULL,
        fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo VARCHAR(20) DEFAULT 'update'
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
        likes INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Tabla comentarios creada/verificada');

    // Función para crear índices de forma segura
    async function createIndexIfNotExists(indexName, tableName, columns) {
      try {
        const checkQuery = `
          SELECT 1 FROM pg_indexes 
          WHERE indexname = $1 AND tablename = $2
        `;
        
        const result = await client.query(checkQuery, [indexName, tableName]);
        
        if (result.rows.length === 0) {
          await client.query(`CREATE INDEX ${indexName} ON ${tableName}(${columns})`);
          console.log(`✅ Índice creado: ${indexName}`);
          return true;
        } else {
          console.log(`📊 Índice ya existe: ${indexName}`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Error creando índice ${indexName}:`, error.message);
        return false;
      }
    }

    // Crear índices importantes
    await createIndexIfNotExists('idx_proyectos_estado', 'proyectos', 'estado');
    await createIndexIfNotExists('idx_proyectos_categoria', 'proyectos', 'categoria');
    await createIndexIfNotExists('idx_inversiones_usuario', 'inversiones', 'id_inversor');
    await createIndexIfNotExists('idx_inversiones_proyecto', 'inversiones', 'id_proyecto');

    console.log('✅ Todas las tablas e índices creados/verificados');

  } catch (error) {
    if (error.code !== '42P07') {
      console.error('❌ Error creando tablas:', error.message);
      throw error;
    }
  }
}

async function getConnection() {
  if (!pool) {
    await initDatabase();
  }
  return await pool.connect();
}

async function query(text, params) {
  if (!pool) {
    await initDatabase();
  }
  
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query ejecutada:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    throw error;
  }
}

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