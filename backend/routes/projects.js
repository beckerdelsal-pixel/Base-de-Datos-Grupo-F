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
    
    const decoded = User.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
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
      projects = await Project.search('', categoria, parseInt(limit), parseInt(offset));
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
      error: 'Error obteniendo proyectos'
    });
  }
});

// BUSCAR PROYECTOS
router.get('/search', async (req, res) => {
  try {
    const { q = '', categoria, limit = 20, offset = 0 } = req.query;
    
    const projects = await Project.search(
      q, 
      categoria, 
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
      error: 'Error buscando proyectos'
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
      error: 'Error obteniendo proyectos destacados'
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
    
    // Incrementar contador de vistas
    await Project.update(project.id, { 
      views_count: (project.views_count || 0) + 1 
    });
    
    // Obtener inversiones del proyecto
    const investments = await Project.getInvestments(project.id);
    
    res.json({
      success: true,
      data: {
        ...project,
        inversiones: investments
      }
    });
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyecto'
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
    .isDate().withMessage('Fecha límite inválida')
    .custom(value => {
      const fechaLimite = new Date(value);
      const hoy = new Date();
      const maxDate = new Date();
      maxDate.setMonth(hoy.getMonth() + 6); // Máximo 6 meses
      
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
    // Verificar que el usuario sea emprendedor
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
      ...req.body
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
      error: 'Error creando proyecto'
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
    if (project.estado !== 'activo') {
      return res.status(400).json({
        success: false,
        error: 'No se puede actualizar un proyecto ' + project.estado
      });
    }
    
    const result = await Project.update(project.id, req.body);
    
    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: result.project
    });
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando proyecto'
    });
  }
});

// ELIMINAR PROYECTO (solo el emprendedor dueño)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario sea emprendedor
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Solo los emprendedores pueden eliminar proyectos'
      });
    }
    
    const deleted = await Project.delete(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado o no tienes permiso'
      });
    }
    
    res.json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando proyecto'
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
        error: 'El proyecto no está activo'
      });
    }
    
    // Verificar que no sea el propio emprendedor
    if (project.id_emprendedor === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'No puedes invertir en tu propio proyecto'
      });
    }
    
    // Verificar si ya invirtió en este proyecto
    const alreadyInvested = await Investment.userHasInvested(project.id, req.user.id);
    if (alreadyInvested) {
      return res.status(400).json({
        success: false,
        error: 'Ya has invertido en este proyecto'
      });
    }
    
    const investmentData = {
      id_proyecto: project.id,
      id_inversor: req.user.id,
      monto: parseFloat(req.body.monto),
      nota: req.body.nota
    };
    
    const investment = await Investment.create(investmentData);
    
    res.status(201).json({
      success: true,
      message: 'Inversión realizada exitosamente',
      data: investment
    });
  } catch (error) {
    console.error('Error realizando inversión:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error realizando inversión'
    });
  }
});

// OBTENER INVERSIONES DE UN PROYECTO
router.get('/:id/investments', async (req, res) => {
  try {
    const investments = await Project.getInvestments(req.params.id);
    
    res.json({
      success: true,
      data: investments
    });
  } catch (error) {
    console.error('Error obteniendo inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo inversiones'
    });
  }
});

module.exports = router;