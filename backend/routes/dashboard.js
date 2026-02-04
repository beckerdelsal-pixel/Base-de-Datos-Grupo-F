const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const Investment = require('../models/Investment');

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

// DASHBOARD PARA EMPRENDEDOR
router.get('/emprendedor', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario sea emprendedor
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Acceso solo para emprendedores'
      });
    }
    
    // Obtener datos del usuario
    const user = await User.findById(req.user.id);
    
    // Obtener proyectos del emprendedor
    const proyectos = await Project.findByEntrepreneur(req.user.id);
    
    // Obtener estadísticas
    const estadisticas = await User.getUserStats(req.user.id, 'emprendedor');
    
    // Calcular total recaudado global
    const totalRecaudado = proyectos.reduce((sum, proyecto) => {
      return sum + parseFloat(proyecto.fondos_recaudados || 0);
    }, 0);
    
    // Proyectos que necesitan atención (menos del 30% recaudado y menos de 15 días)
    const proyectosNecesitanAtencion = proyectos.filter(p => {
      const porcentaje = (p.fondos_recaudados / p.meta_financiera) * 100;
      return porcentaje < 30 && p.dias_restantes < 15;
    });
    
    res.json({
      success: true,
      data: {
        usuario: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          avatar_url: user.avatar_url,
          biografia: user.biografia,
          saldo: user.saldo
        },
        estadisticas: {
          ...estadisticas,
          total_recaudado_global: totalRecaudado,
          proyectos_necesitan_atencion: proyectosNecesitanAtencion.length
        },
        proyectos: proyectos.map(p => ({
          id: p.id,
          titulo: p.titulo,
          descripcion: p.descripcion?.substring(0, 150) + '...',
          meta_financiera: p.meta_financiera,
          fondos_recaudados: p.fondos_recaudados,
          porcentaje_completado: ((p.fondos_recaudados / p.meta_financiera) * 100).toFixed(1),
          estado: p.estado,
          categoria: p.categoria,
          fecha_limite: p.fecha_limite,
          dias_restantes: p.dias_restantes,
          investors_count: p.investors_count || 0,
          views_count: p.views_count || 0
        }))
      }
    });
    
  } catch (error) {
    console.error('Error en dashboard emprendedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo dashboard'
    });
  }
});

// DASHBOARD PARA INVERSOR
router.get('/inversor', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario sea inversor
    if (req.user.tipo_usuario !== 'inversor') {
      return res.status(403).json({
        success: false,
        error: 'Acceso solo para inversores'
      });
    }
    
    // Obtener datos del usuario
    const user = await User.findById(req.user.id);
    
    // Obtener inversiones del usuario
    const inversiones = await Investment.findByUser(req.user.id);
    
    // Obtener estadísticas
    const estadisticas = await User.getUserStats(req.user.id, 'inversor');
    
    // Proyectos recomendados (basados en categorías de inversiones anteriores)
    const categoriasInvertidas = [];
    inversiones.forEach(inv => {
      if (inv.proyecto_categoria && !categoriasInvertidas.includes(inv.proyecto_categoria)) {
        categoriasInvertidas.push(inv.proyecto_categoria);
      }
    });
    
    let proyectosRecomendados = [];
    if (categoriasInvertidas.length > 0) {
      // Buscar proyectos en categorías similares
      const recomendaciones = await Project.search('', categoriasInvertidas[0], 3, 0);
      proyectosRecomendados = recomendaciones.filter(p => 
        !inversiones.some(inv => inv.id_proyecto === p.id)
      );
    }
    
    // Si no hay recomendaciones, obtener proyectos destacados
    if (proyectosRecomendados.length === 0) {
      proyectosRecomendados = await Project.getFeatured(3);
    }
    
    res.json({
      success: true,
      data: {
        usuario: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          avatar_url: user.avatar_url,
          biografia: user.biografia,
          saldo: user.saldo
        },
        estadisticas: {
          ...estadisticas,
          saldo_disponible: user.saldo
        },
        inversiones: inversiones.map(inv => ({
          id: inv.id,
          proyecto_titulo: inv.proyecto_titulo,
          proyecto_estado: inv.proyecto_estado,
          proyecto_imagen: inv.proyecto_imagen,
          emprendedor_nombre: inv.emprendedor_nombre,
          monto: inv.monto,
          fecha_inversion: inv.fecha_inversion,
          porcentaje_completado: inv.porcentaje_completado,
          nota: inv.nota
        })),
        proyectos_recomendados: proyectosRecomendados.map(p => ({
          id: p.id,
          titulo: p.titulo,
          descripcion: p.descripcion?.substring(0, 100) + '...',
          meta_financiera: p.meta_financiera,
          fondos_recaudados: p.fondos_recaudados,
          porcentaje_completado: ((p.fondos_recaudados / p.meta_financiera) * 100).toFixed(1),
          categoria: p.categoria,
          fecha_limite: p.fecha_limite,
          dias_restantes: p.dias_restantes,
          nombre_emprendedor: p.nombre_emprendedor
        }))
      }
    });
    
  } catch (error) {
    console.error('Error en dashboard inversor:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo dashboard'
    });
  }
});

// OBTENER INVERSIONES DEL USUARIO
router.get('/mis-inversiones', authenticate, async (req, res) => {
  try {
    const inversiones = await Investment.findByUser(req.user.id);
    
    res.json({
      success: true,
      data: inversiones
    });
  } catch (error) {
    console.error('Error obteniendo inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo inversiones'
    });
  }
});

// OBTENER PROYECTOS DEL EMPRENDEDOR
router.get('/mis-proyectos', authenticate, async (req, res) => {
  try {
    if (req.user.tipo_usuario !== 'emprendedor') {
      return res.status(403).json({
        success: false,
        error: 'Acceso solo para emprendedores'
      });
    }
    
    const proyectos = await Project.findByEntrepreneur(req.user.id);
    
    res.json({
      success: true,
      data: proyectos
    });
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proyectos'
    });
  }
});

module.exports = router;