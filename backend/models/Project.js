import { query } from '../db/db.js';

class Project {
  // Crear nuevo proyecto
  static async create(projectData) {
    try {
      const {
        id_emprendedor,
        titulo,
        descripcion,
        meta_financiera,
        fecha_limite,
        categoria,
        imagen_url,
        tags
      } = projectData;

      const result = await query(
        `INSERT INTO proyectos 
         (id_emprendedor, titulo, descripcion, meta_financiera, fecha_limite, categoria, imagen_url, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id_emprendedor, titulo, descripcion, meta_financiera, fecha_limite, categoria, imagen_url, tags]
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
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.id = $1`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error obteniendo proyecto por ID:', error);
      throw error;
    }
  }

  // Obtener todos los proyectos activos
  static async findAllActive(limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.estado = 'activo' AND p.fecha_limite::DATE > CURRENT_DATE
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

  // Obtener proyectos por categoría
  static async findByCategory(categoria, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.categoria = $1 AND p.estado = 'activo' AND p.fecha_limite::DATE > CURRENT_DATE
         ORDER BY p.fecha_creacion DESC
         LIMIT $2 OFFSET $3`,
        [categoria, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo proyectos por categoría:', error);
      throw error;
    }
  }

  // Obtener proyectos por emprendedor
  static async findByEntrepreneur(emprendedorId) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
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

  // Obtener proyectos destacados
  static async getFeatured(limit = 6) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.estado = 'activo' AND p.fecha_limite::DATE > CURRENT_DATE
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

  // Obtener proyectos populares (más visitados)
  static async getPopular(limit = 6) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.estado = 'activo' AND p.fecha_limite::DATE > CURRENT_DATE
         ORDER BY p.views_count DESC, p.investors_count DESC
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo proyectos populares:', error);
      throw error;
    }
  }

  // Actualizar proyecto
  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }

      values.push(id);

      const result = await query(
        `UPDATE proyectos 
         SET ${fields.join(', ')} 
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error actualizando proyecto:', error);
      throw error;
    }
  }

  // Eliminar proyecto (soft delete)
  static async delete(id) {
    try {
      const result = await query(
        `UPDATE proyectos 
         SET estado = 'cancelado'
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      throw error;
    }
  }

  // Incrementar contador de vistas
  static async incrementViews(id) {
    try {
      const result = await query(
        `UPDATE proyectos 
         SET views_count = views_count + 1 
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error incrementando vistas:', error);
      throw error;
    }
  }

  // Actualizar fondos recaudados
  static async updateFunds(id, amount) {
    try {
      const result = await query(
        `UPDATE proyectos 
         SET fondos_recaudados = fondos_recaudados + $1,
             investors_count = investors_count + 1
         WHERE id = $2
         RETURNING *`,
        [amount, id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error actualizando fondos:', error);
      throw error;
    }
  }

  // Buscar proyectos
  static async search(queryText, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE (p.titulo ILIKE $1 OR p.descripcion ILIKE $1 OR p.tags ILIKE $1)
           AND p.estado = 'activo' AND p.fecha_limite::DATE > CURRENT_DATE
         ORDER BY p.fecha_creacion DESC
         LIMIT $2 OFFSET $3`,
        [`%${queryText}%`, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error buscando proyectos:', error);
      throw error;
    }
  }

  // Obtener proyectos próximos a expirar
  static async getExpiringSoon(limit = 10) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado,
                EXTRACT(DAY FROM (p.fecha_limite::DATE - CURRENT_DATE)) as dias_restantes
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.estado = 'activo' 
           AND p.fecha_limite::DATE > CURRENT_DATE
           AND p.fecha_limite::DATE <= CURRENT_DATE + INTERVAL '7 days'
         ORDER BY p.fecha_limite ASC
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo proyectos próximos a expirar:', error);
      throw error;
    }
  }

  // Obtener proyectos exitosos (completados)
  static async getSuccessful(limit = 10) {
    try {
      const result = await query(
        `SELECT p.*, u.nombre as nombre_emprendedor, u.imagen_url as imagen_emprendedor,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE p.estado = 'completado'
         ORDER BY p.fondos_recaudados DESC
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo proyectos exitosos:', error);
      throw error;
    }
  }

  // Obtener estadísticas de proyecto
  static async getProjectStats(id) {
    try {
      const result = await query(
        `SELECT 
           p.*,
           u.nombre as nombre_emprendedor,
           u.email as email_emprendedor,
           u.imagen_url as imagen_emprendedor,
           COUNT(DISTINCT i.id) as total_inversores,
           COUNT(DISTINCT up.id) as total_updates,
           AVG(i.monto) as promedio_inversion,
           MAX(i.monto) as mayor_inversion
         FROM proyectos p
         JOIN usuarios u ON p.id_emprendedor = u.id
         LEFT JOIN inversiones i ON p.id = i.id_proyecto
         LEFT JOIN updates up ON p.id = up.id_proyecto
         WHERE p.id = $1
         GROUP BY p.id, u.nombre, u.email, u.imagen_url`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de proyecto:', error);
      throw error;
    }
  }
}

export default Project;