const { query } = require('../config/database');

class Investment {
  // Crear nueva inversión
  static async create(investmentData) {
    try {
      // Iniciar transacción
      await query('BEGIN');
      
      // 1. Verificar que el inversor tenga suficiente saldo
      const userResult = await query(
        'SELECT saldo FROM usuarios WHERE id = $1 FOR UPDATE',
        [investmentData.id_inversor]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('Inversor no encontrado');
      }
      
      const saldoActual = parseFloat(userResult.rows[0].saldo);
      if (saldoActual < investmentData.monto) {
        throw new Error('Saldo insuficiente');
      }
      
      // 2. Verificar que el proyecto esté activo
      const projectResult = await query(
        'SELECT estado, fecha_limite FROM proyectos WHERE id = $1 FOR UPDATE',
        [investmentData.id_proyecto]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Proyecto no encontrado');
      }
      
      const proyecto = projectResult.rows[0];
      if (proyecto.estado !== 'activo') {
        throw new Error('El proyecto no está activo');
      }
      
      // 3. Verificar que la fecha límite no haya pasado
      if (new Date(proyecto.fecha_limite) < new Date()) {
        throw new Error('El proyecto ha expirado');
      }
      
      // 4. Crear la inversión
      const result = await query(
        `INSERT INTO inversiones (id_proyecto, id_inversor, monto, nota)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          investmentData.id_proyecto,
          investmentData.id_inversor,
          investmentData.monto,
          investmentData.nota || ''
        ]
      );
      
      // 5. Actualizar saldo del inversor
      await query(
        'UPDATE usuarios SET saldo = saldo - $1 WHERE id = $2',
        [investmentData.monto, investmentData.id_inversor]
      );
      
      // 6. Actualizar fondos del proyecto
      await query(
        'UPDATE proyectos SET fondos_recaudados = fondos_recaudados + $1 WHERE id = $2',
        [investmentData.monto, investmentData.id_proyecto]
      );
      
      // Confirmar transacción
      await query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      console.error('Error creando inversión:', error);
      throw error;
    }
  }
  
  // Obtener inversiones por usuario
  static async findByUser(userId) {
    try {
      const result = await query(
        `SELECT i.*, p.titulo as proyecto_titulo, p.estado as proyecto_estado,
                p.imagen_url as proyecto_imagen, u.nombre as emprendedor_nombre,
                (p.fondos_recaudados / p.meta_financiera * 100) as porcentaje_completado
         FROM inversiones i
         JOIN proyectos p ON i.id_proyecto = p.id
         JOIN usuarios u ON p.id_emprendedor = u.id
         WHERE i.id_inversor = $1
         ORDER BY i.fecha_inversion DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo inversiones por usuario:', error);
      throw error;
    }
  }
  
  // Obtener inversión por ID
  static async findById(id) {
    try {
      const result = await query(
        `SELECT i.*, p.titulo as proyecto_titulo, u_inv.nombre as inversor_nombre,
                u_emp.nombre as emprendedor_nombre, p.descripcion as proyecto_descripcion
         FROM inversiones i
         JOIN proyectos p ON i.id_proyecto = p.id
         JOIN usuarios u_inv ON i.id_inversor = u_inv.id
         JOIN usuarios u_emp ON p.id_emprendedor = u_emp.id
         WHERE i.id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error obteniendo inversión:', error);
      throw error;
    }
  }
  
  // Obtener estadísticas de inversiones por usuario
  static async getUserStats(userId) {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_inversiones,
          SUM(monto) as total_invertido,
          COUNT(DISTINCT id_proyecto) as proyectos_diferentes,
          AVG(monto) as promedio_inversion
         FROM inversiones 
         WHERE id_inversor = $1 AND estado = 'activa'`,
        [userId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de inversiones:', error);
      throw error;
    }
  }
  
  // Verificar si el usuario ya invirtió en el proyecto
  static async userHasInvested(projectId, userId) {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM inversiones WHERE id_proyecto = $1 AND id_inversor = $2',
        [projectId, userId]
      );
      
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error verificando inversión:', error);
      throw error;
    }
  }
  
  // Obtener inversiones recientes
  static async getRecent(limit = 10) {
    try {
      const result = await query(
        `SELECT i.*, p.titulo as proyecto_titulo, u_inv.nombre as inversor_nombre,
                u_emp.nombre as emprendedor_nombre
         FROM inversiones i
         JOIN proyectos p ON i.id_proyecto = p.id
         JOIN usuarios u_inv ON i.id_inversor = u_inv.id
         JOIN usuarios u_emp ON p.id_emprendedor = u_emp.id
         ORDER BY i.fecha_inversion DESC
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo inversiones recientes:', error);
      throw error;
    }
  }
}

module.exports = Investment;