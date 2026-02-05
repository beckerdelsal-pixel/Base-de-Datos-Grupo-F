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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTAS DE AUTENTICACIÓN ---

// REGISTRO REAL
app.post('/api/auth/register', async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    try {
        const query = `
            INSERT INTO usuarios (nombre, email, password, rol)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nombre, email, rol;
        `;
        const values = [nombre, email, password, rol];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'El correo ya existe o hubo un error en la base de datos' });
    }
});

// LOGIN REAL
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Buscamos al usuario por email y password
        const query = 'SELECT id, nombre, email, rol FROM usuarios WHERE email = $1 AND password = $2';
        const result = await pool.query(query, [email, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({
                token: 'sesion-activa-' + user.id, // Token temporal
                user: user
            });
        } else {
            res.status(401).json({ message: 'Correo o contraseña incorrectos' });
        }
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// --- RUTAS DE PROYECTOS ---

app.post('/api/proyectos', async (req, res) => {
    const { emprendedor_id, nombre, descripcion, meta, categoria } = req.body;
    if (!nombre || !meta) return res.status(400).json({ error: 'Datos incompletos' });

    try {
        const query = `
            INSERT INTO proyectos (emprendedor_id, nombre, descripcion, meta, actual, categoria)
            VALUES ($1, $2, $3, $4, 0, $5)
            RETURNING *;
        `;
        const values = [emprendedor_id || null, nombre, descripcion, meta, categoria];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar proyecto' });
    }
});

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proyectos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error en DB' });
    }
});

// Obtener datos de un usuario específico (incluyendo saldo)
app.get('/api/usuarios/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, email, rol, saldo FROM usuarios WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar usuario' });
    }
});

// RUTA PARA ACTUALIZAR SALDO
app.put('/api/usuarios/saldo', async (req, res) => {
    const { userId, monto } = req.body;
    try {
        const query = `
            UPDATE usuarios 
            SET saldo = COALESCE(saldo, 0) + $1 
            WHERE id = $2 
            RETURNING saldo;
        `;
        const result = await pool.query(query, [parseFloat(monto), userId]);

        if (result.rows.length > 0) {
            res.json({ nuevoSaldo: result.rows[0].saldo });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar saldo' });
    }
});

// --- RUTA 2: INVERTIR EN PROYECTO (La nueva, para mover dinero entre tablas) ---
app.post('/api/proyectos/invertir', async (req, res) => {
    const { userId, proyectoId, monto } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Restar saldo al inversionista
        const resUser = await client.query(
            'UPDATE usuarios SET saldo = saldo - $1 WHERE id = $2 AND saldo >= $1 RETURNING saldo',
            [monto, userId]
        );
        if (resUser.rows.length === 0) throw new Error('Saldo insuficiente');

        // 2. Sumar al proyecto
        await client.query('UPDATE proyectos SET actual = actual + $1 WHERE id = $2', [monto, proyectoId]);

        // 3. REGISTRAR EL MOVIMIENTO EN LA NUEVA TABLA
        await client.query(
            'INSERT INTO inversiones (usuario_id, proyecto_id, monto) VALUES ($1, $2, $3)',
            [userId, proyectoId, monto]
        );

        await client.query('COMMIT');
        res.json({ mensaje: 'Inversión exitosa', nuevoSaldo: resUser.rows[0].saldo });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Obtener proyectos de un emprendedor específico
app.get('/api/proyectos/usuario/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT * FROM proyectos WHERE emprendedor_id = $1 ORDER BY id DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener tus proyectos' });
    }
});

app.get('/api/usuarios/:id/inversiones', async (req, res) => {
    try {
        const query = `
            SELECT i.monto, i.fecha_inversion, p.nombre as proyecto_nombre 
            FROM inversiones i 
            JOIN proyectos p ON i.proyecto_id = p.id 
            WHERE i.usuario_id = $1 
            ORDER BY i.fecha_inversion DESC;
        `;
        const result = await pool.query(query, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// Ruta de Salud y Redirección
app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});