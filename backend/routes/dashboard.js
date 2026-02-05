const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Investment = require('../models/Investment');

// Middleware de autenticación (el mismo que ya tienes)
const authenticate = require('../middleware/auth'); // O copia tu middleware aquí

// GET /api/dashboard/emprendedor
router.get('/emprendedor', authenticate, async (req, res) => {
  try {
    // Verificar que sea emprendedor
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Acceso solo para emprendedores'
      });
    }
    
    // 1. Obtener proyectos del emprendedor
    const proyectos = await Project.findByEntrepreneur(req.user.id);
    
    // 2. Calcular estadísticas
    let totalRecaudado = 0;
    let totalMeta = 0;
    let proyectosActivos = 0;
    let proyectosCompletados = 0;
    
    proyectos.forEach(proyecto => {
      totalRecaudado += parseFloat(proyecto.fondos_recaudados) || 0;
      totalMeta += parseFloat(proyecto.meta_financiera) || 0;
      
      if (proyecto.estado === 'activo') proyectosActivos++;
      if (proyecto.estado === 'completado') proyectosCompletados++;
    });
    
    // 3. Obtener inversiones recientes (si tienes modelo Investment)
    let inversionesRecientes = [];
    try {
      // Esto depende de cómo tengas tu modelo Investment
      // inversionesRecientes = await Investment.findRecentByEntrepreneur(req.user.id);
    } catch (e) {
      console.warn('No se pudieron obtener inversiones:', e.message);
    }
    
    // 4. Preparar respuesta
    const dashboardData = {
      usuario: {
        id: req.user.id,
        nombre: req.user.nombre,
        email: req.user.email,
        tipo_usuario: req.user.tipo_usuario
      },
      estadisticas: {
        totalProyectos: proyectos.length,
        proyectosActivos,
        proyectosCompletados,
        totalRecaudado,
        totalMeta,
        porcentajeCompletado: totalMeta > 0 ? (totalRecaudado / totalMeta * 100) : 0
      },
      proyectos: proyectos.map(p => ({
        ...p,
        porcentaje_completado: p.meta_financiera > 0 
          ? (p.fondos_recaudados / p.meta_financiera * 100) 
          : 0,
        dias_restantes: Math.ceil((new Date(p.fecha_limite) - new Date()) / (1000 * 60 * 60 * 24))
      })),
      inversionesRecientes,
      actualizado: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Error en dashboard emprendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando dashboard'
    });
  }
});

// GET /api/dashboard/inversionista
router.get('/inversionista', authenticate, async (req, res) => {
  try {
    // Similar para inversionistas...
    res.json({
      success: true,
      data: { message: 'Dashboard inversionista' }
    });
  } catch (error) {
    console.error('Error en dashboard inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando dashboard'
    });
  }
});

module.exports = router;