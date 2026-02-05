const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const Investment = require('../models/Investment');
const { query } = require('../config/database');

// ESTADÍSTICAS GLOBALES
router.get('/global', async (req, res) => {
  try {
    // Obtener estadísticas de usuarios
    const usersStats = await query(`
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(CASE WHEN tipo_usuario = 'emprendedor' THEN 1 END) as total_emprendedores,
        COUNT(CASE WHEN tipo_usuario = 'inversor' THEN 1 END) as total_inversores,
        COALESCE(SUM(saldo), 0) as capital_total
      FROM usuarios 
      WHERE estado = 'activo'
    `);

    // Obtener estadísticas de proyectos
    const projectsStats = await query(`
      SELECT 
        COUNT(*) as total_proyectos,
        COUNT(CASE WHEN estado = 'completado' THEN 1 END) as proyectos_financiados,
        COUNT(CASE WHEN estado = 'activo' THEN 1 END) as proyectos_activos,
        COUNT(CASE WHEN estado = 'expirado' THEN 1 END) as proyectos_expirados,
        COALESCE(SUM(fondos_recaudados), 0) as capital_movilizado,
        COALESCE(AVG(fondos_recaudados), 0) as promedio_recaudacion,
        COALESCE(SUM(meta_financiera), 0) as total_meta
      FROM proyectos
    `);

    // Obtener estadísticas de inversiones
    const investmentsStats = await query(`
      SELECT 
        COUNT(*) as total_inversiones,
        COALESCE(SUM(monto), 0) as total_invertido,
        COALESCE(AVG(monto), 0) as promedio_inversion,
        COUNT(DISTINCT id_inversor) as inversores_unicos,
        COUNT(DISTINCT id_proyecto) as proyectos_invertidos
      FROM inversiones
      WHERE estado = 'activa'
    `);

    // Proyectos destacados
    const featuredProjects = await query(`
  SELECT p.id, p.titulo, p.descripcion, p.meta_financiera, p.fondos_recaudados,
         p.categoria, p.fecha_limite, p.estado, p.imagen_url,
         u.nombre as nombre_emprendedor,
         (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
         EXTRACT(DAY FROM (TO_TIMESTAMP(p.fecha_limite) - CURRENT_DATE)) as dias_restantes
  FROM proyectos p
  JOIN usuarios u ON p.id_emprendedor = u.id
  WHERE p.estado = 'activo' AND TO_TIMESTAMP(p.fecha_limite) > CURRENT_DATE
  ORDER BY (p.fondos_recaudados / p.meta_financiera) DESC, p.investors_count DESC
  LIMIT 6
`);

    // Inversiones recientes
    const recentInvestments = await query(`
      SELECT i.monto, i.fecha_inversion,
             p.titulo as proyecto_titulo,
             u_inv.nombre as inversor_nombre,
             u_emp.nombre as emprendedor_nombre
      FROM inversiones i
      JOIN proyectos p ON i.id_proyecto = p.id
      JOIN usuarios u_inv ON i.id_inversor = u_inv.id
      JOIN usuarios u_emp ON p.id_emprendedor = u_emp.id
      ORDER BY i.fecha_inversion DESC
      LIMIT 5
    `);

    // Categorías más populares
    const popularCategories = await query(`
      SELECT categoria, COUNT(*) as total_proyectos,
             SUM(fondos_recaudados) as total_recaudado
      FROM proyectos
      WHERE categoria IS NOT NULL AND categoria != ''
      GROUP BY categoria
      ORDER BY total_recaudado DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        usuarios: usersStats.rows[0],
        proyectos: projectsStats.rows[0],
        inversiones: investmentsStats.rows[0],
        destacados: featuredProjects.rows,
        recientes: recentInvestments.rows,
        categorias_populares: popularCategories.rows,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

// ESTADÍSTICAS EN TIEMPO REAL
router.get('/realtime', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    // Inversiones hoy
    const todayStats = await query(`
      SELECT 
        COUNT(*) as inversiones_hoy,
        COALESCE(SUM(monto), 0) as monto_hoy
      FROM inversiones 
      WHERE DATE(fecha_inversion) = $1
    `, [hoy]);

    // Nuevos usuarios hoy
    const newUsers = await query(`
      SELECT COUNT(*) as nuevos_usuarios_hoy
      FROM usuarios 
      WHERE DATE(fecha_registro) = $1
    `, [hoy]);

    // Nuevos proyectos hoy
    const newProjects = await query(`
      SELECT COUNT(*) as nuevos_proyectos_hoy
      FROM proyectos 
      WHERE DATE(fecha_creacion) = $1
    `, [hoy]);

    // Proyectos que expiran pronto (en 7 días)
    const expiring = await query(`
      SELECT COUNT(*) as proyectos_por_expiracion
      FROM proyectos 
      WHERE estado = 'activo' 
      AND fecha_limite <= CURRENT_DATE + INTERVAL '7 days'
    `);

    // Proyectos casi completados (>80%)
    const almostCompleted = await query(`
      SELECT COUNT(*) as proyectos_casi_completados
      FROM proyectos 
      WHERE estado = 'activo'
      AND (fondos_recaudados / meta_financiera * 100) >= 80
      AND (fondos_recaudados / meta_financiera * 100) < 100
    `);

    res.json({
      success: true,
      data: {
        hoy: {
          ...todayStats.rows[0],
          ...newUsers.rows[0],
          ...newProjects.rows[0]
        },
        alertas: {
          ...expiring.rows[0],
          ...almostCompleted.rows[0]
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error estadísticas tiempo real:', error);
    res.status(500).json({
      success: false,
      error: 'Error servidor'
    });
  }
});

module.exports = router;