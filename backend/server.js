const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Base de Datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// --- LA CLAVE ESTÁ AQUÍ ---
// Servir archivos desde la carpeta hermana 'frontend'
app.use(express.static(path.join(__dirname, '../frontend')));

// RUTA PARA CREAR UN NUEVO PROYECTO
app.post('/api/proyectos', async (req, res) => {
    // Extraemos los datos que vienen desde el frontend
    const { emprendedor_id, nombre, descripcion, meta, categoria } = req.body;

    // Validación básica
    if (!nombre || !meta) {
        return res.status(400).json({ error: 'Nombre y Meta son obligatorios' });
    }

    try {
        const query = `
            INSERT INTO proyectos (emprendedor_id, nombre, descripcion, meta, actual, categoria)
            VALUES ($1, $2, $3, $4, 0, $5)
            RETURNING *;
        `;
        
        const values = [emprendedor_id || null, nombre, descripcion, meta, categoria];
        const result = await pool.query(query, values);

        // Devolvemos el proyecto recién creado
        res.status(201).json(result.rows[0]);
        
    } catch (err) {
        console.error('Error al insertar proyecto:', err);
        res.status(500).json({ error: 'Error interno del servidor al guardar el proyecto' });
    }
});

// Rutas de API
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    // Simulación de respuesta para pruebas rápidas
    res.json({ 
        token: 'abc-123', 
        user: { nombre: 'Usuario Prueba', rol: email.includes('inv') ? 'inversionista' : 'emprendedor' } 
    });
});

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proyectos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error en DB' });
    }
});

// Ruta de Salud
app.get('/health', (req, res) => res.status(200).send('OK'));

// Redireccionar cualquier otra ruta al index.html del frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo y buscando frontend en ../frontend`);
});