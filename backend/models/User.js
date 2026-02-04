const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class User {
  // Crear nuevo usuario
  static async create(userData) {
    try {
      // Hashear contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Saldo inicial según tipo de usuario
      const saldoInicial = userData.tipo_usuario === 'inversor' ? 1000 : 0;
      
      const result = await query(
        `INSERT INTO usuarios 
         (nombre, email, password, tipo_usuario, saldo, biografia, pais) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, nombre, email, tipo_usuario, saldo, fecha_registro`,
        [
          userData.nombre,
          userData.email,
          hashedPassword,
          userData.tipo_usuario,
          saldoInicial,
          userData.biografia || '',
          userData.pais || ''
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }
  
  // Buscar usuario por email
  static async findByEmail(email) {
    try {
      const result = await query(
        `SELECT id, nombre, email, password, tipo_usuario, saldo, 
                fecha_registro, estado, avatar_url, biografia, telefono, pais
         FROM usuarios 
         WHERE email = $1 AND estado = 'activo'`,
        [email]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error buscando usuario por email:', error);
      throw error;
    }
  }
  
  // Buscar usuario por ID
  static async findById(id) {
    try {
      const result = await query(
        `SELECT id, nombre, email, tipo_usuario, saldo, 
                fecha_registro, estado, avatar_url, biografia, telefono, pais
         FROM usuarios 
         WHERE id = $1 AND estado = 'activo'`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error buscando usuario por ID:', error);
      throw error;
    }
  }
  
  // Verificar contraseña
  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
  
  // Actualizar último login
  static async updateLastLogin(userId) {
    try {
      await query(
        'UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error actualizando último login:', error);
    }
  }
  
  // Actualizar perfil
  static async updateProfile(userId, profileData) {
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      // Construir dinámicamente la consulta
      for (const [key, value] of Object.entries(profileData)) {
        if (value !== undefined && value !== null) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }
      
      if (updates.length === 0) {
        return { success: false, message: 'No hay datos para actualizar' };
      }
      
      values.push(userId);
      
      const result = await query(
        `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramCount} 
         RETURNING id, nombre, email, tipo_usuario, saldo, biografia, avatar_url, telefono, pais`,
        values
      );
      
      return {
        success: true,
        user: result.rows[0]
      };
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  }
  
  // Recargar saldo (para inversores)
  static async rechargeBalance(userId, amount) {
    try {
      const result = await query(
        `UPDATE usuarios SET saldo = saldo + $1 
         WHERE id = $2 AND tipo_usuario = 'inversor'
         RETURNING id, saldo`,
        [amount, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado o no es inversor');
      }
      
      return {
        success: true,
        newBalance: result.rows[0].saldo
      };
    } catch (error) {
      console.error('Error recargando saldo:', error);
      throw error;
    }
  }
  
  // Obtener saldo
  static async getBalance(userId) {
    try {
      const result = await query(
        'SELECT saldo FROM usuarios WHERE id = $1',
        [userId]
      );
      
      return result.rows[0]?.saldo || 0;
    } catch (error) {
      console.error('Error obteniendo saldo:', error);
      throw error;
    }
  }
  
  // Generar token JWT
  static generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        tipo_usuario: user.tipo_usuario
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }
  
  // Verificar token JWT
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
  
  // Obtener estadísticas del usuario
  static async getUserStats(userId, tipoUsuario) {
    try {
      if (tipoUsuario === 'emprendedor') {
        // Estadísticas para emprendedor
        const result = await query(
          `SELECT 
            COUNT(*) as total_proyectos,
            COUNT(CASE WHEN estado = 'completado' THEN 1 END) as proyectos_completados,
            COUNT(CASE WHEN estado = 'activo' THEN 1 END) as proyectos_activos,
            SUM(fondos_recaudados) as total_recaudado,
            COALESCE(AVG(fondos_recaudados), 0) as promedio_recaudacion
           FROM proyectos 
           WHERE id_emprendedor = $1`,
          [userId]
        );
        
        return result.rows[0];
      } else {
        // Estadísticas para inversor
        const result = await query(
          `SELECT 
            COUNT(*) as total_inversiones,
            SUM(monto) as total_invertido,
            COUNT(DISTINCT id_proyecto) as proyectos_diferentes,
            COALESCE(AVG(monto), 0) as promedio_inversion
           FROM inversiones 
           WHERE id_inversor = $1 AND estado = 'activa'`,
          [userId]
        );
        
        return result.rows[0];
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuario:', error);
      throw error;
    }
  }
  
  // Verificar si email ya existe
  static async emailExists(email) {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM usuarios WHERE email = $1',
        [email]
      );
      
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error verificando email:', error);
      throw error;
    }
  }
}

module.exports = User;