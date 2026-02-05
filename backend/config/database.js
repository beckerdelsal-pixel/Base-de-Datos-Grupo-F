const { Pool } = require('pg');

let globalPool = null;

async function ensureTablesExist() {
    if (!globalPool) {
        globalPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL?.includes('render.com') 
                ? { rejectUnauthorized: false } 
                : false
        });
    }
    
    const client = await globalPool.connect();
    try {
        // Tabla Usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                tipo_usuario VARCHAR(20) CHECK (tipo_usuario IN ('emprendedor', 'inversor')),
                saldo DECIMAL(10,2) DEFAULT 0,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Tabla Proyectos
        await client.query(`
            CREATE TABLE IF NOT EXISTS proyectos (
                id SERIAL PRIMARY KEY,
                id_emprendedor INTEGER REFERENCES usuarios(id),
                titulo VARCHAR(200) NOT NULL,
                descripcion TEXT,
                meta_financiera DECIMAL(10,2) NOT NULL,
                fondos_recaudados DECIMAL(10,2) DEFAULT 0,
                estado VARCHAR(20) DEFAULT 'activo',
                fecha_limite DATE NOT NULL
            )
        `);
        console.log('✅ Base de Datos Sincronizada');
    } finally {
        client.release();
    }
    return globalPool;
}

const query = (text, params) => globalPool.query(text, params);
const initDatabase = () => ensureTablesExist();

module.exports = { initDatabase, query, pool: () => globalPool };