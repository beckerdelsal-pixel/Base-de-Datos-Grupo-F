const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Configuración del pool de conexiones Oracle
const initOracleConnection = async () => {
  try {
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      poolMin: parseInt(process.env.DB_POOL_MIN),
      poolMax: parseInt(process.env.DB_POOL_MAX),
      poolIncrement: parseInt(process.env.DB_POOL_INCREMENT),
      poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT)
    });
    console.log('Pool de conexión Oracle creado exitosamente');
  } catch (err) {
    console.error('Error creando el pool de conexión:', err);
  }
};

// Obtener conexión del pool
const getConnection = async () => {
  return await oracledb.getConnection();
};

// 🔐 **ENDPOINTS DE AUTENTICACIÓN**

// Registro de usuario
app.post('/api/auth/register', [
  body('nombre').notEmpty().withMessage('Nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
  body('tipo_usuario').isIn(['inversor', 'emprendedor']).withMessage('Tipo inválido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { nombre, email, password, tipo_usuario } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    connection = await getConnection();
    
    const result = await connection.execute(
      `INSERT INTO usuarios (nombre, email, password, tipo_usuario) 
       VALUES (:1, :2, :3, :4) RETURNING id_usuario INTO :5`,
      [nombre, email, hashedPassword, tipo_usuario, { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }],
      { autoCommit: true }
    );
    
    const userId = result.outBinds[0][0];
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      userId: userId
    });
  } catch (err) {
    if (err.errorNum === 1) { // Error de unique constraint
      res.status(400).json({ error: 'El email ya está registrado' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (connection) await connection.close();
  }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;
    
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT id_usuario, nombre, email, password, tipo_usuario, saldo 
       FROM usuarios WHERE email = :1`,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.PASSWORD);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign(
      { 
        id: user.ID_USUARIO, 
        email: user.EMAIL, 
        tipo: user.TIPO_USUARIO 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.ID_USUARIO,
        nombre: user.NOMBRE,
        email: user.EMAIL,
        tipo_usuario: user.TIPO_USUARIO,
        saldo: user.SALDO
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 📊 **ENDPOINTS DE PROYECTOS**

// Obtener todos los proyectos activos
// Endpoint para consultar proyectos - VERSIÓN CORREGIDA
app.get('/api/proyectos', async (req, res) => {
  let connection;
  try {
    const { categoria, estado } = req.query;
    
    connection = await getConnection();
    
    // QUERY MODIFICADA: Convertir CLOB a VARCHAR2
    let query = `
      SELECT 
        p.id_proyecto,
        p.id_emprendedor,
        p.titulo,
        -- Convertir CLOB a string (primeros 4000 caracteres)
        DBMS_LOB.SUBSTR(p.descripcion, 4000, 1) as descripcion,
        p.categoria,
        p.meta_financiera,
        p.fondos_recaudados,
        TO_CHAR(p.fecha_creacion, 'YYYY-MM-DD') as fecha_creacion,
        TO_CHAR(p.fecha_limite, 'YYYY-MM-DD') as fecha_limite,
        p.estado,
        u.nombre as nombre_emprendedor,
        ROUND((p.fondos_recaudados / p.meta_financiera) * 100, 2) as porcentaje_completado,
        TRUNC(p.fecha_limite - SYSDATE) as dias_restantes
      FROM proyectos p
      JOIN usuarios u ON p.id_emprendedor = u.id_usuario
      WHERE 1=1
    `;
    
    const binds = [];
    
    if (categoria) {
      query += ` AND p.categoria = :${binds.length + 1}`;
      binds.push(categoria);
    }
    
    if (estado) {
      query += ` AND p.estado = :${binds.length + 1}`;
      binds.push(estado);
    } else {
      query += ` AND p.estado = 'activo'`;
    }
    
    query += ` ORDER BY p.fecha_creacion DESC`;
    
    const result = await connection.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Crear nuevo proyecto (solo emprendedores)
app.post('/api/proyectos', authenticateToken, [
  body('titulo').notEmpty().withMessage('Título es requerido'),
  body('descripcion').notEmpty().withMessage('Descripción es requerida'),
  body('meta_financiera').isNumeric().withMessage('Meta financiera debe ser numérica'),
  body('fecha_limite').isISO8601().withMessage('Fecha límite inválida')
], async (req, res) => {
  if (req.user.tipo !== 'emprendedor') {
    return res.status(403).json({ error: 'Solo emprendedores pueden crear proyectos' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { titulo, descripcion, categoria, meta_financiera, fecha_limite } = req.body;
    
    connection = await getConnection();
    
    const result = await connection.execute(
      `INSERT INTO proyectos (id_emprendedor, titulo, descripcion, categoria, meta_financiera, fecha_limite)
       VALUES (:1, :2, :3, :4, :5, TO_DATE(:6, 'YYYY-MM-DD'))
       RETURNING id_proyecto INTO :7`,
      [
        req.user.id,
        titulo,
        descripcion,
        categoria,
        parseFloat(meta_financiera),
        fecha_limite,
        { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      ],
      { autoCommit: true }
    );
    
    const projectId = result.outBinds[0][0];
    
    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      projectId: projectId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 💰 **ENDPOINTS DE INVERSIONES**

// Realizar una inversión
app.post('/api/inversiones', authenticateToken, [
  body('id_proyecto').isNumeric().withMessage('ID de proyecto inválido'),
  body('monto').isNumeric().withMessage('Monto inválido'),
  body('recompensa').optional().isString()
], async (req, res) => {
  if (req.user.tipo !== 'inversor') {
    return res.status(403).json({ error: 'Solo inversores pueden realizar inversiones' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { id_proyecto, monto, recompensa } = req.body;
    
    connection = await getConnection();
    
    // Verificar saldo del inversor
    const userResult = await connection.execute(
      `SELECT saldo FROM usuarios WHERE id_usuario = :1`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (userResult.rows[0].SALDO < monto) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }
    
    // Verificar proyecto activo
    const projectResult = await connection.execute(
      `SELECT estado, meta_financiera, fondos_recaudados 
       FROM proyectos WHERE id_proyecto = :1`,
      [id_proyecto],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (projectResult.rows[0].ESTADO !== 'activo') {
      return res.status(400).json({ error: 'Proyecto no disponible para inversión' });
    }
    
    // Iniciar transacción
    await connection.execute(
      `BEGIN
         -- Crear inversión
         INSERT INTO inversiones (id_inversor, id_proyecto, monto, recompensa)
         VALUES (:1, :2, :3, :4);
         
         -- Actualizar saldo del inversor
         UPDATE usuarios SET saldo = saldo - :3 WHERE id_usuario = :1;
         
         -- Actualizar fondos del proyecto
         UPDATE proyectos 
         SET fondos_recaudados = fondos_recaudados + :3 
         WHERE id_proyecto = :2;
         
         -- Verificar si se completó la meta
         DECLARE
           v_fondos NUMBER;
           v_meta NUMBER;
         BEGIN
           SELECT fondos_recaudados, meta_financiera 
           INTO v_fondos, v_meta 
           FROM proyectos 
           WHERE id_proyecto = :2;
           
           IF v_fondos >= v_meta THEN
             UPDATE proyectos SET estado = 'completado' WHERE id_proyecto = :2;
           END IF;
         END;
       END;`,
      [req.user.id, id_proyecto, parseFloat(monto), recompessa || null],
      { autoCommit: true }
    );
    
    res.json({
      success: true,
      message: 'Inversión realizada exitosamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 📈 **ENDPOINTS DE DASHBOARD**

// Dashboard para emprendedores
app.get('/api/dashboard/emprendedor', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'emprendedor') {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // Proyectos del emprendedor
    const proyectosResult = await connection.execute(
      `SELECT p.*, 
              COUNT(i.id_inversion) as total_inversiones,
              SUM(i.monto) as total_recaudado
       FROM proyectos p
       LEFT JOIN inversiones i ON p.id_proyecto = i.id_proyecto
       WHERE p.id_emprendedor = :1
       GROUP BY p.id_proyecto, p.titulo, p.descripcion, p.categoria,
                p.meta_financiera, p.fondos_recaudados, p.fecha_creacion,
                p.fecha_limite, p.estado
       ORDER BY p.fecha_creacion DESC`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    // Estadísticas
    const statsResult = await connection.execute(
      `SELECT 
         COUNT(*) as total_proyectos,
         SUM(fondos_recaudados) as total_recaudado_global,
         AVG(fondos_recaudados) as promedio_recaudado,
         COUNT(CASE WHEN estado = 'completado' THEN 1 END) as proyectos_completados
       FROM proyectos 
       WHERE id_emprendedor = :1`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    res.json({
      proyectos: proyectosResult.rows,
      estadisticas: statsResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Dashboard para inversores
app.get('/api/dashboard/inversor', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'inversor') {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }

  let connection;
  try {
    connection = await getConnection();
    
    // Inversiones del usuario
    const inversionesResult = await connection.execute(
      `SELECT i.*, p.titulo as proyecto_titulo, p.estado as proyecto_estado,
              u.nombre as nombre_emprendedor
       FROM inversiones i
       JOIN proyectos p ON i.id_proyecto = p.id_proyecto
       JOIN usuarios u ON p.id_emprendedor = u.id_usuario
       WHERE i.id_inversor = :1
       ORDER BY i.fecha_inversion DESC`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    // Estadísticas
    const statsResult = await connection.execute(
      `SELECT 
         COUNT(*) as total_inversiones,
         SUM(i.monto) as total_invertido,
         AVG(i.monto) as promedio_inversion,
         COUNT(DISTINCT i.id_proyecto) as proyectos_diferentes
       FROM inversiones i
       WHERE i.id_inversor = :1`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    // Proyectos recomendados
    const recomendadosResult = await connection.execute(
      `SELECT p.*, u.nombre as nombre_emprendedor,
              ROUND((p.fondos_recaudados / p.meta_financiera) * 100, 2) as porcentaje_completado
       FROM proyectos p
       JOIN usuarios u ON p.id_emprendedor = u.id_usuario
       WHERE p.estado = 'activo'
         AND p.id_proyecto NOT IN (
           SELECT id_proyecto FROM inversiones WHERE id_inversor = :1
         )
       ORDER BY p.fecha_creacion DESC
       FETCH FIRST 5 ROWS ONLY`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    res.json({
      inversiones: inversionesResult.rows,
      estadisticas: statsResult.rows[0],
      proyectos_recomendados: recomendadosResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 💳 **ENDPOINTS DE SALDO**

// Recargar saldo
app.post('/api/saldo/recargar', authenticateToken, [
  body('monto').isNumeric().withMessage('Monto inválido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { monto } = req.body;
    
    connection = await getConnection();
    
    await connection.execute(
      `UPDATE usuarios SET saldo = saldo + :1 WHERE id_usuario = :2`,
      [parseFloat(monto), req.user.id],
      { autoCommit: true }
    );
    
    res.json({
      success: true,
      message: 'Saldo recargado exitosamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Obtener saldo actual
app.get('/api/saldo', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT saldo FROM usuarios WHERE id_usuario = :1`,
      [req.user.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    res.json({ saldo: result.rows[0].SALDO });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 📝 **ENDPOINTS DE COMENTARIOS Y ACTUALIZACIONES**

// Agregar comentario a proyecto
app.post('/api/proyectos/:id/comentarios', authenticateToken, [
  body('comentario').notEmpty().withMessage('Comentario es requerido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { id } = req.params;
    const { comentario } = req.body;
    
    connection = await getConnection();
    
    await connection.execute(
      `INSERT INTO comentarios (id_proyecto, id_usuario, comentario)
       VALUES (:1, :2, :3)`,
      [id, req.user.id, comentario],
      { autoCommit: true }
    );
    
    res.json({
      success: true,
      message: 'Comentario agregado exitosamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Agregar actualización a proyecto (solo emprendedor dueño)
app.post('/api/proyectos/:id/actualizaciones', authenticateToken, [
  body('titulo').notEmpty().withMessage('Título es requerido'),
  body('contenido').notEmpty().withMessage('Contenido es requerido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let connection;
  try {
    const { id } = req.params;
    const { titulo, contenido } = req.body;
    
    // Verificar que el usuario es el emprendedor dueño
    connection = await getConnection();
    
    const proyectoResult = await connection.execute(
      `SELECT id_emprendedor FROM proyectos WHERE id_proyecto = :1`,
      [id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (proyectoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    
    if (proyectoResult.rows[0].ID_EMPRENDEDOR !== req.user.id) {
      return res.status(403).json({ error: 'No eres el emprendedor de este proyecto' });
    }
    
    await connection.execute(
      `INSERT INTO actualizaciones (id_proyecto, titulo, contenido)
       VALUES (:1, :2, :3)`,
      [id, titulo, contenido],
      { autoCommit: true }
    );
    
    res.json({
      success: true,
      message: 'Actualización publicada exitosamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 📋 **ENDPOINTS ADICIONALES**

// Buscar proyectos
app.get('/api/proyectos/buscar', async (req, res) => {
  let connection;
  try {
    const { q, categoria, min_meta, max_meta } = req.query;
    
    connection = await getConnection();
    
    let query = `
      SELECT p.*, u.nombre as nombre_emprendedor,
             ROUND((p.fondos_recaudados / p.meta_financiera) * 100, 2) as porcentaje_completado
      FROM proyectos p
      JOIN usuarios u ON p.id_emprendedor = u.id_usuario
      WHERE p.estado = 'activo'
    `;
    
    const binds = [];
    
    if (q) {
      query += ` AND (LOWER(p.titulo) LIKE LOWER(:${binds.length + 1}) 
                OR LOWER(p.descripcion) LIKE LOWER(:${binds.length + 2}))`;
      binds.push(`%${q}%`);
      binds.push(`%${q}%`);
    }
    
    if (categoria) {
      query += ` AND p.categoria = :${binds.length + 1}`;
      binds.push(categoria);
    }
    
    if (min_meta) {
      query += ` AND p.meta_financiera >= :${binds.length + 1}`;
      binds.push(parseFloat(min_meta));
    }
    
    if (max_meta) {
      query += ` AND p.meta_financiera <= :${binds.length + 1}`;
      binds.push(parseFloat(max_meta));
    }
    
    query += ` ORDER BY p.fecha_creacion DESC`;
    
    const result = await connection.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Proyectos más populares
app.get('/api/proyectos/populares', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT p.*, u.nombre as nombre_emprendedor,
              ROUND((p.fondos_recaudados / p.meta_financiera) * 100, 2) as porcentaje_completado,
              COUNT(i.id_inversion) as total_inversores
       FROM proyectos p
       JOIN usuarios u ON p.id_emprendedor = u.id_usuario
       LEFT JOIN inversiones i ON p.id_proyecto = i.id_proyecto
       WHERE p.estado = 'activo'
       GROUP BY p.id_proyecto, p.titulo, p.descripcion, p.categoria,
                p.meta_financiera, p.fondos_recaudados, p.fecha_creacion,
                p.fecha_limite, p.estado, u.nombre
       ORDER BY total_inversores DESC, porcentaje_completado DESC
       FETCH FIRST 10 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Inicializar servidor
const PORT = process.env.PORT || 3000;

initOracleConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor de crowdfunding ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Endpoints disponibles:`);
    console.log(`   POST   /api/auth/register`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/proyectos`);
    console.log(`   POST   /api/proyectos`);
    console.log(`   POST   /api/inversiones`);
    console.log(`   GET    /api/dashboard/emprendedor`);
    console.log(`   GET    /api/dashboard/inversor`);
    console.log(`   POST   /api/saldo/recargar`);
  });
}).catch(err => {
  console.error('Error inicializando la aplicación:', err);
});

// Manejo de errores global
process.on('SIGINT', async () => {
  console.log('Cerrando pool de conexiones Oracle...');
  try {
    await oracledb.getPool().close(10);
    console.log('Pool cerrado exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('Error cerrando el pool:', err);
    process.exit(1);
  }
});