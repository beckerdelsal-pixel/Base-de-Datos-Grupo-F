const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const Project = require('../models/Project');
const Investment = require('../models/Investment');
const User = require('../models/User');

// Middleware para verificar autenticación
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }
    
    // NOTA: Necesitas implementar verifyToken en User o usar otro método
    // Esto es temporal - ajusta según tu implementación real
    const decoded = { 
      id: 1, 
      tipo_usuario: 'inversor' 
    }; // Temporal - reemplaza con tu lógica real
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).json({
      success: false,
      error: 'Error de autenticación'
    });
  }
};

// OBTENER TODOS LOS PROYECTOS ACTIVOS
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, categoria } = req.query;
    
    let projects;
    if (categoria) {
      projects = await Project.findByCategory(
        categoria, 
        parseInt(limit), 
        parseInt(offset)
      );
    } else {
      projects = await Project.findAllActive(parseInt(limit), parseInt(offset));
    }
    
    res.json({
      success: true,
      data: projects,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: projects.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos: ' + error.message
    });
  }
});

// BUSCAR PROYECTOS
router.get('/search', async (req, res) => {
  try {
    const { q = '', limit = 20, offset = 0 } = req.query;
    // NOTA: Tu función search actual no acepta categoría como parámetro separado
    const projects = await Project.search(
      q, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      data: projects,
      query: q,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: projects.length
      }
    });
  } catch (error) {
    console.error('Error buscando proyectos:', error);
    res.status(500).json({
      success: false,
      error: 'Error buscando proyectos: ' + error.message
    });
  }
});

// OBTENER PROYECTOS DESTACADOS
router.get('/featured', async (req, res) => {
  try {
    const projects = await Project.getFeatured(6);
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error obteniendo proyectos destacados:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos destacados: ' + error.message
    });
  }
});

// OBTENER PROYECTOS POPULARES
router.get('/popular', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const projects = await Project.getPopular(parseInt(limit));
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error obteniendo proyectos populares:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos populares'
    });
  }
});

// OBTENER PROYECTOS PRÓXIMOS A EXPIRAR
router.get('/expiring-soon', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const projects = await Project.getExpiringSoon(parseInt(limit));
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error obteniendo proyectos próximos a expirar:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos próximos a expirar'
    });
  }
});

// OBTENER PROYECTO POR ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado'
      });
    }
    
    // Incrementar contador de vistas (usando el método correcto)
    await Project.incrementViews(project.id);
    
    // Obtener estadísticas del proyecto (si existe el método)
    let projectStats = {};
    try {
      projectStats = await Project.getProjectStats(project.id) || {};
    } catch (statsError) {
      console.warn('No se pudieron obtener estadísticas del proyecto:', statsError.message);
    }
    
    res.json({
      success: true,
      data: {
        ...project,
        estadisticas: projectStats
      }
    });
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyecto: ' + error.message
    });
  }
});

// CREAR NUEVO PROYECTO (solo emprendedores)
router.post('/', authenticate, [
  body('titulo')
    .notEmpty().withMessage('El título es requerido')
    .isLength({ max: 200 }).withMessage('El título no puede exceder 200 caracteres'),
  body('descripcion')
    .notEmpty().withMessage('La descripción es requerida')
    .isLength({ min: 50 }).withMessage('La descripción debe tener al menos 50 caracteres'),
  body('meta_financiera')
    .isFloat({ min: 100, max: 1000000 }).withMessage('La meta debe estar entre 100 y 1,000,000'),
  body('fecha_limite')
    .isISO8601().withMessage('Fecha límite inválida (usar formato YYYY-MM-DD)')
    .custom(value => {
      const fechaLimite = new Date(value);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Solo fecha, sin hora
      
      const maxDate = new Date();
      maxDate.setMonth(hoy.getMonth() + 6); // Máximo 6 meses
      maxDate.setHours(23, 59, 59, 999);
      
      if (fechaLimite <= hoy) {
        throw new Error('La fecha límite debe ser futura');
      }
      if (fechaLimite > maxDate) {
        throw new Error('La fecha límite no puede ser mayor a 6 meses');
      }
      return true;
    }),
  body('categoria')
    .optional()
    .isIn(['tecnologia', 'ecologia', 'salud', 'educacion', 'arte', 'otros'])
    .withMessage('Categoría inválida')
], async (req, res) => {
  try {
    // Verificar que el usuario sea emprendedor (temporal - ajusta según tu lógica)
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Solo los emprendedores pueden crear proyectos'
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
    
    const projectData = {
      id_emprendedor: req.user.id,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      meta_financiera: parseFloat(req.body.meta_financiera),
      fecha_limite: req.body.fecha_limite,
      categoria: req.body.categoria || 'otros',
      imagen_url: req.body.imagen_url || 'default-project.jpg',
      tags: req.body.tags || ''
    };
    
    const project = await Project.create(projectData);
    
    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: project
    });
  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando proyecto: ' + error.message
    });
  }
});

// ACTUALIZAR PROYECTO (solo el emprendedor dueño)
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario sea emprendedor
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Solo los emprendedores pueden actualizar proyectos'
      });
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado'
      });
    }
    
    // Verificar que el usuario sea el dueño del proyecto
    if (project.id_emprendedor !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para actualizar este proyecto'
      });
    }
    
    // No permitir actualizar si el proyecto está completado o expirado
    if (!['activo', 'pendiente'].includes(project.estado)) {
      return res.status(400).json({
        success: false,
        error: 'No se puede actualizar un proyecto ' + project.estado
      });
    }
    
    // Campos permitidos para actualización
    const allowedUpdates = ['titulo', 'descripcion', 'categoria', 'imagen_url', 'tags'];
    const updateData = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    // Solo actualizar si hay campos válidos
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionaron campos válidos para actualizar'
      });
    }
    
    const result = await Project.update(project.id, updateData);
    
    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando proyecto: ' + error.message
    });
  }
});

// ELIMINAR/CANCELAR PROYECTO (solo el emprendedor dueño)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario sea emprendedor
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Solo los emprendedores pueden eliminar proyectos'
      });
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado'
      });
    }
    
    // Verificar que el usuario sea el dueño del proyecto
    if (project.id_emprendedor !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para eliminar este proyecto'
      });
    }
    
    // Soft delete - cambiar estado a 'cancelado'
    const deleted = await Project.update(project.id, { estado: 'cancelado' });
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Error al cancelar el proyecto'
      });
    }
    
    res.json({
      success: true,
      message: 'Proyecto cancelado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando proyecto: ' + error.message
    });
  }
});

// REALIZAR INVERSIÓN EN PROYECTO (solo inversores)
router.post('/:id/invest', authenticate, [
  body('monto')
    .isFloat({ min: 1 }).withMessage('El monto debe ser mayor a 0')
    .custom((value, { req }) => {
      if (value > 10000) {
        throw new Error('El monto máximo por inversión es 10,000');
      }
      return true;
    }),
  body('nota').optional().trim().escape()
], async (req, res) => {
  try {
    // Verificar que el usuario sea inversor
    if (req.user.tipo_usuario !== 'inversor') {
      return res.status(403).json({
        success: false,
        error: 'Solo los inversores pueden realizar inversiones'
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
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado'
      });
    }
    
    // Verificar que el proyecto esté activo
    if (project.estado !== 'activo') {
      return res.status(400).json({
        success: false,
        error: `El proyecto no está activo (estado: ${project.estado})`
      });
    }
    
    // Verificar que la fecha límite no haya pasado
    const fechaLimite = new Date(project.fecha_limite);
    const hoy = new Date();
    if (fechaLimite < hoy) {
      return res.status(400).json({
        success: false,
        error: 'El proyecto ha expirado'
      });
    }
    
    // Verificar que no sea el propio emprendedor
    if (project.id_emprendedor === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'No puedes invertir en tu propio proyecto'
      });
    }
    
    const investmentData = {
      id_proyecto: project.id,
      id_inversor: req.user.id,
      monto: parseFloat(req.body.monto),
      nota: req.body.nota || ''
    };
    
    // NOTA: Necesitas tener un modelo Investment con método create
    // Esto es temporal - descomenta cuando tengas el modelo
    /*
    const investment = await Investment.create(investmentData);
    
    // Actualizar fondos del proyecto
    await Project.updateFunds(project.id, investmentData.monto);
    */
    
    // TEMPORAL: Simular inversión hasta que tengas el modelo
    const investment = {
      id: Date.now(),
      ...investmentData,
      fecha: new Date().toISOString(),
      estado: 'completado'
    };
    
    // Actualizar fondos del proyecto (simulado)
    const updatedProject = await Project.updateFunds(project.id, investmentData.monto);
    
    res.status(201).json({
      success: true,
      message: 'Inversión realizada exitosamente',
      data: {
        inversion: investment,
        proyecto: updatedProject
      }
    });
  } catch (error) {
    console.error('Error realizando inversión:', error);
    res.status(500).json({
      success: false,
      error: 'Error realizando inversión: ' + error.message
    });
  }
});

// OBTENER INVERSIONES DE UN PROYECTO
router.get('/:id/investments', async (req, res) => {
  try {
    // NOTA: Necesitas implementar getProjectStats o método similar
    const projectStats = await Project.getProjectStats(req.params.id) || {};
    
    res.json({
      success: true,
      data: {
        inversiones: projectStats.total_inversores || 0,
        detalles: projectStats // Incluye otras estadísticas
      }
    });
  } catch (error) {
    console.error('Error obteniendo inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo inversiones: ' + error.message
    });
  }
});

// OBTENER PROYECTOS EXITOSOS (completados)
router.get('/successful/projects', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const projects = await Project.getSuccessful(parseInt(limit));
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error obteniendo proyectos exitosos:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos exitosos'
    });
  }
});

module.exports = router;
