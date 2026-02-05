const db = require('../config/database');  // ✅ Nueva forma

class Project {
  // Crear nuevo proyecto
  static async create(projectData) {
    try {
      const result = await db.query(  // ✅ Cambiado: db.query
        `INSERT INTO proyectos 
         (id_emprendedor, titulo, descripcion, meta_financiera, fecha_limite, categoria, tags) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          projectData.id_emprendedor,
          projectData.titulo,
          projectData.descripcion,
          projectData.meta_financiera,
          projectData.fecha_limite,
          projectData.categoria || 'general',
          projectData.tags || ''
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creando proyecto:', error);
      throw error;
    }
  }
  
  // Obtener proyecto por ID
  static async findById(id) {
    try {
      const result = await db.query(  // ✅ Cambiado: db.query
        `SELECT p.*, u.nombre as nombre_emprendedor, u.avatar_url as avatar_emprendedor,
                u.biografia as biografia_emprendedor
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error obteniendo proyecto:', error);
      throw error;
    }
  }
  
  // Obtener todos los proyectos activos
static async findAllActive(limit = 20, offset = 0) {
  try {
    const result = await db.query(
      `SELECT p.*, u.nombre as nombre_emprendedor,
              (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
              EXTRACT(DAY FROM (TO_TIMESTAMP(p.fecha_limite) - CURRENT_DATE)) as dias_restantes
       FROM proyectos p
       JOIN usuarios u ON p.id_emprendedor = u.id
       WHERE p.estado = 'activo' AND TO_TIMESTAMP(p.fecha_limite) > CURRENT_DATE
       ORDER BY p.fecha_creacion DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo proyectos activos:', error);
    throw error;
  }
}
  
  // Obtener proyectos por emprendedor
static async findByEntrepreneur(emprendedorId) {
  try {
    const result = await db.query(
      `SELECT p.*, 
              (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
              EXTRACT(DAY FROM (TO_TIMESTAMP(p.fecha_limite) - CURRENT_DATE)) as dias_restantes
       FROM proyectos p
       WHERE p.id_emprendedor = $1
       ORDER BY p.fecha_creacion DESC`,
      [emprendedorId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo proyectos por emprendedor:', error);
    throw error;
  }
}
  
  // Buscar proyectos
  static async search(queryText, categoria = null, limit = 20, offset = 0) {
    try {
      let sql = `
        SELECT p.*, u.nombre as nombre_emprendedor,
               (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado
        FROM proyectos p
        JOIN usuarios u ON p.id_emprendedor = u.id
        WHERE p.estado = 'activo' 
          AND (p.titulo ILIKE $1 OR p.descripcion ILIKE $1 OR p.tags ILIKE $1)
      `;
      
      const params = [`%${queryText}%`];
      let paramCount = 2;
      
      if (categoria) {
        sql += ` AND p.categoria = $${paramCount}`;
        params.push(categoria);
        paramCount++;
      }
      
      sql += ` ORDER BY p.fecha_creacion DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
      
      const result = await db.query(sql, params);  // ✅ Cambiado: db.query
      return result.rows;
    } catch (error) {
      console.error('Error buscando proyectos:', error);
      throw error;
    }
  }
  
  // Actualizar fondos recaudados
  static async updateFunds(projectId, amount) {
    try {
      const result = await db.query(  // ✅ Cambiado: db.query
        `UPDATE proyectos 
         SET fondos_recaudados = fondos_recaudados + $1,
             investors_count = investors_count + 1
         WHERE id = $2
         RETURNING fondos_recaudados, meta_financiera`,
        [amount, projectId]
      );
      
      // Verificar si se completó la meta
      const project = result.rows[0];
      if (project.fondos_recaudados >= project.meta_financiera) {
        await db.query(  // ✅ Cambiado: db.query
          "UPDATE proyectos SET estado = 'completado' WHERE id = $1",
          [projectId]
        );
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error actualizando fondos:', error);
      throw error;
    }
  }
  
  // Obtener proyectos destacados
static async getFeatured(limit = 6) {
  try {
    const result = await db.query(
      `SELECT p.*, u.nombre as nombre_emprendedor,
              (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
              EXTRACT(DAY FROM (TO_TIMESTAMP(p.fecha_limite) - CURRENT_DATE)) as dias_restantes
       FROM proyectos p
       JOIN usuarios u ON p.id_emprendedor = u.id
       WHERE p.estado = 'activo' AND TO_TIMESTAMP(p.fecha_limite) > CURRENT_DATE
       ORDER BY p.fondos_recaudados DESC, p.investors_count DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo proyectos destacados:', error);
    throw error;
  }
}
  
  // Actualizar proyecto
  static async update(projectId, updateData) {
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && value !== null) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }
      
      if (updates.length === 0) {
        return { success: false, message: 'No hay datos para actualizar' };
      }
      
      values.push(projectId);
      
      const result = await db.query(  // ✅ Cambiado: db.query
        `UPDATE proyectos SET ${updates.join(', ')} 
         WHERE id = $${paramCount} 
         RETURNING *`,
        values
      );
      
      return {
        success: true,
        project: result.rows[0]
      };
    } catch (error) {
      console.error('Error actualizando proyecto:', error);
      throw error;
    }
  }
  
  // Eliminar proyecto (cambiar estado)
  static async delete(projectId, emprendedorId) {
    try {
      const result = await db.query(  // ✅ Cambiado: db.query
        `UPDATE proyectos SET estado = 'cancelado' 
         WHERE id = $1 AND id_emprendedor = $2
         RETURNING id`,
        [projectId, emprendedorId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      throw error;
    }
  }
  
  // Obtener inversiones del proyecto
  static async getInvestments(projectId) {
    try {
      const result = await db.query(  // ✅ Cambiado: db.query
        `SELECT i.*, u.nombre as nombre_inversor, u.avatar_url as avatar_inversor
         FROM inversiones i
         JOIN usuarios u ON i.id_inversor = u.id
         WHERE i.id_proyecto = $1
         ORDER BY i.fecha_inversion DESC`,
        [projectId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo inversiones:', error);
      throw error;
    }
  }
  
  // Obtener estadísticas globales
  static async getGlobalStats() {
    try {
      const result = await db.query(`  // ✅ Cambiado: db.query
        SELECT 
          COUNT(*) as total_proyectos,
          COUNT(CASE WHEN estado = 'completado' THEN 1 END) as proyectos_financiados,
          COUNT(CASE WHEN estado = 'activo' THEN 1 END) as proyectos_activos,
          SUM(fondos_recaudados) as capital_movilizado,
          AVG(fondos_recaudados) as promedio_recaudacion
        FROM proyectos
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas globales:', error);
      throw error;
    }
  }
}

module.exports = Project;