const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database'); // ✅ Importar db completo

const User = {
  async emailExists(email) {
    try {
      const result = await db.query(
        'SELECT 1 FROM usuarios WHERE email = $1',
        [email]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  },

  async create(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const result = await db.query(
        `INSERT INTO usuarios (nombre, email, password, tipo_usuario, biografia, pais) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, nombre, email, tipo_usuario, saldo, fecha_registro, estado`,
        [
          userData.nombre,
          userData.email,
          hashedPassword,
          userData.tipo_usuario,
          userData.biografia || '',
          userData.pais || ''
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async findByEmail(email) {
    try {
      const result = await db.query(
        'SELECT * FROM usuarios WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  },

  async findById(id) {
    try {
      const result = await db.query(
        'SELECT * FROM usuarios WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error finding user by id:', error);
      return null;
    }
  },

  generateToken(user) {
    const secret = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        tipo_usuario: user.tipo_usuario 
      },
      secret,
      { expiresIn: '7d' }
    );
  },

  verifyToken(token) {
    try {
      const secret = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
      return jwt.verify(token, secret);
    } catch (error) {
      console.error('Token verification error:', error.message);
      return null;
    }
  },

  async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  },

  async updateLastLogin(userId) {
    try {
      await db.query(
        'UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  },

  async getUserStats(userId, userType) {
    try {
      if (userType === 'emprendedor') {
        const result = await db.query(`
          SELECT 
            COUNT(*) as total_proyectos,
            COALESCE(SUM(fondos_recaudados), 0) as total_recaudado,
            COALESCE(SUM(investors_count), 0) as total_inversores
          FROM proyectos 
          WHERE id_emprendedor = $1
        `, [userId]);
        return result.rows[0] || { total_proyectos: 0, total_recaudado: 0, total_inversores: 0 };
      } else {
        const result = await db.query(`
          SELECT 
            COUNT(*) as total_inversiones,
            COALESCE(SUM(monto), 0) as total_invertido,
            COUNT(DISTINCT id_proyecto) as proyectos_invertidos
          FROM inversiones 
          WHERE id_inversor = $1
        `, [userId]);
        return result.rows[0] || { total_inversiones: 0, total_invertido: 0, proyectos_invertidos: 0 };
      }
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {};
    }
  },

  async updateProfile(userId, data) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (data.nombre) {
        fields.push(`nombre = $${paramCount}`);
        values.push(data.nombre);
        paramCount++;
      }

      if (data.biografia !== undefined) {
        fields.push(`biografia = $${paramCount}`);
        values.push(data.biografia);
        paramCount++;
      }

      if (data.telefono) {
        fields.push(`telefono = $${paramCount}`);
        values.push(data.telefono);
        paramCount++;
      }

      if (data.pais) {
        fields.push(`pais = $${paramCount}`);
        values.push(data.pais);
        paramCount++;
      }

      if (fields.length === 0) {
        return { success: false, error: 'No hay datos para actualizar' };
      }

      values.push(userId);
      const queryText = `
        UPDATE usuarios 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING id, nombre, email, tipo_usuario, saldo, avatar_url, 
                  biografia, telefono, pais, fecha_registro
      `;

      const result = await db.query(queryText, values);
      
      return {
        success: true,
        user: result.rows[0]
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  },

  async rechargeBalance(userId, amount) {
    try {
      const result = await db.query(
        `UPDATE usuarios 
         SET saldo = saldo + $1 
         WHERE id = $2 AND tipo_usuario = 'inversor'
         RETURNING saldo`,
        [amount, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado o no es inversor');
      }

      return {
        success: true,
        newBalance: parseFloat(result.rows[0].saldo)
      };
    } catch (error) {
      console.error('Error recharging balance:', error);
      throw error;
    }
  }
};

module.exports = User;