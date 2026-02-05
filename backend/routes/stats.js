import express from 'express';
import { query } from '../db/db.js';

const router = express.Router();

// Función auxiliar para convertir fechas (maneja tanto DATE como INTEGER timestamps)
const convertDateField = (field) => {
  return `CASE 
    WHEN pg_typeof(${field}) = 'integer'::regtype 
    THEN TO_TIMESTAMP(${field}::double precision)
    ELSE ${field}::timestamp 
  END`;
};

// GET /api/stats - Obtener estadísticas globales
router.get('/', async (req, res) => {
  try {
    console.log('📊 Solicitando estadísticas globales...');

    // 1. Estadísticas básicas (en paralelo para mejor performance)
    const [
      totalUsuarios,
      totalProyectos,
      totalInversiones,
      totalFondos,
      proyectosActivos
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM usuarios'),
      query('SELECT COUNT(*) FROM proyectos'),
      query('SELECT COUNT(*) FROM inversiones'),
      query('SELECT COALESCE(SUM(fondos_recaudados), 0) as sum FROM proyectos'),
      query("SELECT COUNT(*) FROM proyectos WHERE estado = 'activo'")
    ]);

    // 2. Estadísticas mensuales (CORREGIDO - maneja diferentes tipos de fecha)
    const monthlyStats = await query(`
      WITH all_dates AS (
        SELECT fecha_creacion as fecha FROM usuarios WHERE fecha_creacion IS NOT NULL
        UNION ALL
        SELECT fecha_creacion as fecha FROM proyectos WHERE fecha_creacion IS NOT NULL
        UNION ALL
        SELECT fecha as fecha FROM inversiones WHERE fecha IS NOT NULL
      )
      SELECT 
        EXTRACT(YEAR FROM ${convertDateField('fecha')}) as year,
        EXTRACT(MONTH FROM ${convertDateField('fecha')}) as month,
        COUNT(*) as count
      FROM all_dates
      GROUP BY 
        EXTRACT(YEAR FROM ${convertDateField('fecha')}), 
        EXTRACT(MONTH FROM ${convertDateField('fecha')})
      ORDER BY year DESC, month DESC
      LIMIT 12
    `);

    // 3. Crecimiento por categoría (CORREGIDO)
    const categoryGrowth = await query(`
      SELECT 
        p.categoria,
        EXTRACT(YEAR FROM ${convertDateField('p.fecha_creacion')}) as year,
        EXTRACT(MONTH FROM ${convertDateField('p.fecha_creacion')}) as month,
        COUNT(*) as proyectos,
        COALESCE(SUM(p.meta_financiera), 0) as meta_total,
        COALESCE(SUM(p.fondos_recaudados), 0) as recaudado_total,
        ROUND(COALESCE(SUM(p.fondos_recaudados) / NULLIF(SUM(p.meta_financiera), 0) * 100, 0), 2) as porcentaje_promedio
      FROM proyectos p
      WHERE p.categoria IS NOT NULL 
        AND p.fecha_creacion IS NOT NULL
      GROUP BY 
        p.categoria, 
        EXTRACT(YEAR FROM ${convertDateField('p.fecha_creacion')}), 
        EXTRACT(MONTH FROM ${convertDateField('p.fecha_creacion')})
      ORDER BY year DESC, month DESC, proyectos DESC
      LIMIT 20
    `);

    // 4. Top inversores
    const topInvestors = await query(`
      SELECT u.id, u.nombre, u.email, u.imagen_url,
             COUNT(i.id) as inversiones_count,
             COALESCE(SUM(i.monto), 0) as total_invertido,
             ROUND(COALESCE(AVG(i.monto), 0), 2) as promedio_inversion
      FROM usuarios u
      LEFT JOIN inversiones i ON u.id = i.id_inversor
      GROUP BY u.id, u.nombre, u.email, u.imagen_url
      HAVING COUNT(i.id) > 0
      ORDER BY total_invertido DESC
      LIMIT 10
    `);

    // 5. Proyectos destacados (CORREGIDO)
    const featuredProjects = await query(`
      SELECT p.id, p.titulo, p.descripcion, p.meta_financiera, p.fondos_recaudados,
             p.categoria, p.fecha_limite, p.estado, p.imagen_url,
             u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
             ROUND((p.fondos_recaudados / NULLIF(p.meta_financiera, 0) * 100), 2) as porcentaje_completado,
             GREATEST(EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)), 0) as dias_restantes,
             p.investors_count, p.views_count
      FROM proyectos p
      JOIN usuarios u ON p.id_emprendedor = u.id
      WHERE p.estado = 'activo' 
        AND p.fecha_limite::DATE > CURRENT_DATE
        AND p.meta_financiera > 0
      ORDER BY (p.fondos_recaudados / p.meta_financiera) DESC, 
               p.investors_count DESC, 
               p.views_count DESC
      LIMIT 6
    `);

    // 6. Distribución de estados
    const statusDistribution = await query(`
      SELECT 
        estado, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM proyectos), 2) as porcentaje
      FROM proyectos
      GROUP BY estado
      ORDER BY count DESC
    `);

    // 7. Métricas financieras adicionales
    const financialMetrics = await query(`
      SELECT 
        COUNT(*) as proyectos_financiados,
        COALESCE(SUM(CASE WHEN fondos_recaudados >= meta_financiera THEN 1 ELSE 0 END), 0) as proyectos_exitosos,
        ROUND(COALESCE(AVG(fondos_recaudados / NULLIF(meta_financiera, 0) * 100), 0), 2) as porcentaje_promedio_financiacion,
        COALESCE(SUM(fondos_recaudados), 0) as total_recaudado_todos,
        COALESCE(SUM(meta_financiera), 0) as total_meta_todos
      FROM proyectos
      WHERE estado IN ('activo', 'completado')
    `);

    // Formatear respuesta
    const stats = {
      totals: {
        usuarios: parseInt(totalUsuarios.rows[0].count) || 0,
        proyectos: parseInt(totalProyectos.rows[0].count) || 0,
        inversiones: parseInt(totalInversiones.rows[0].count) || 0,
        fondos: parseFloat(totalFondos.rows[0].sum) || 0,
        activos: parseInt(proyectosActivos.rows[0].count) || 0
      },
      financial: financialMetrics.rows[0],
      monthlyStats: monthlyStats.rows,
      categoryGrowth: categoryGrowth.rows,
      topInvestors: topInvestors.rows,
      featuredProjects: featuredProjects.rows,
      statusDistribution: statusDistribution.rows,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    console.log('✅ Estadísticas generadas exitosamente');
    res.json(stats);

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas globales:', error);
    
    // Respuesta de error más detallada
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo estadísticas globales',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/stats/health - Health check para estadísticas
router.get('/health', async (req, res) => {
  try {
    const dbCheck = await query('SELECT 1 as ok');
    const proyectosCount = await query('SELECT COUNT(*) as count FROM proyectos');
    
    res.json({
      status: 'healthy',
      database: dbCheck.rows[0].ok === 1 ? 'connected' : 'error',
      proyectos: parseInt(proyectosCount.rows[0].count) || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;