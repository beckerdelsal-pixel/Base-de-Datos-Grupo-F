const cron = require('node-cron');
const { query } = require('../config/database');

// Tarea diaria: Mantenimiento de la base de datos
cron.schedule('0 2 * * *', async () => { // Corre todos los días a las 2 AM
  console.log('🔄 Ejecutando mantenimiento diario...');
  
  try {
    // 1. Marcar proyectos expirados
    await query(`
      UPDATE proyectos 
      SET estado = 'expirado' 
      WHERE estado = 'activo' 
      AND fecha_limite < CURRENT_DATE
    `);
    
    console.log('✅ Proyectos expirados actualizados');
    
    // 2. Verificar proyectos completados automáticamente
    await query(`
      UPDATE proyectos 
      SET estado = 'completado' 
      WHERE estado = 'activo' 
      AND fondos_recaudados >= meta_financiera
    `);
    
    console.log('✅ Proyectos completados actualizados');
    
    // 3. Limpiar tokens expirados (si tienes tabla de tokens)
    // await query(`DELETE FROM user_tokens WHERE expires_at < NOW()`);
    
    // 4. Actualizar estadísticas de usuarios
    await query(`
      UPDATE usuarios u
      SET saldo = COALESCE((
        SELECT 1000 + SUM(i.monto)
        FROM inversiones i
        WHERE i.id_inversor = u.id
        AND i.estado = 'reembolsada'
      ), 0)
      WHERE u.tipo_usuario = 'inversor'
    `);
    
    console.log('✅ Estadísticas actualizadas');
    
    // 5. Backup de datos importantes (log solamente)
    const backupStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) as total_usuarios,
        (SELECT COUNT(*) FROM proyectos) as total_proyectos,
        (SELECT SUM(fondos_recaudados) FROM proyectos) as total_recaudado,
        (SELECT SUM(monto) FROM inversiones) as total_invertido
    `);
    
    console.log('📊 Estadísticas de backup:', backupStats.rows[0]);
    
  } catch (error) {
    console.error('❌ Error en mantenimiento diario:', error);
  }
});

// Tarea semanal: Reportes y limpieza
cron.schedule('0 3 * * 1', async () => { // Corre todos los lunes a las 3 AM
  console.log('📊 Generando reporte semanal...');
  
  try {
    // Obtener estadísticas semanales
    const weeklyStats = await query(`
      SELECT 
        COUNT(*) as nuevos_usuarios_semana,
        COUNT(CASE WHEN tipo_usuario = 'emprendedor' THEN 1 END) as nuevos_emprendedores,
        COUNT(CASE WHEN tipo_usuario = 'inversor' THEN 1 END) as nuevos_inversores,
        (SELECT COUNT(*) FROM proyectos WHERE fecha_creacion > NOW() - INTERVAL '7 days') as nuevos_proyectos,
        (SELECT SUM(fondos_recaudados) FROM proyectos WHERE fecha_creacion > NOW() - INTERVAL '7 days') as recaudado_semana,
        (SELECT COUNT(*) FROM inversiones WHERE fecha_inversion > NOW() - INTERVAL '7 days') as nuevas_inversiones,
        (SELECT SUM(monto) FROM inversiones WHERE fecha_inversion > NOW() - INTERVAL '7 days') as invertido_semana
      FROM usuarios 
      WHERE fecha_registro > NOW() - INTERVAL '7 days'
    `);
    
    console.log('📈 Reporte semanal:', weeklyStats.rows[0]);
    
    // Aquí podrías enviar un email con el reporte al administrador
    // emailService.sendWeeklyReport(weeklyStats.rows[0]);
    
  } catch (error) {
    console.error('❌ Error en reporte semanal:', error);
  }
});

// Tarea mensual: Limpieza profunda
cron.schedule('0 4 1 * *', async () => { // Corre el primer día de cada mes a las 4 AM
  console.log('🧹 Realizando limpieza mensual...');
  
  try {
    // Archivar proyectos muy antiguos (más de 1 año)
    await query(`
      UPDATE proyectos 
      SET estado = 'archivado' 
      WHERE estado IN ('expirado', 'cancelado') 
      AND fecha_limite < NOW() - INTERVAL '1 year'
    `);
    
    console.log('✅ Proyectos antiguos archivados');
    
    // Limpiar logs antiguos (si tienes tabla de logs)
    // await query(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '3 months'`);
    
    // Optimizar tablas (VACUUM en PostgreSQL)
    await query('VACUUM ANALYZE');
    
    console.log('✅ Base de datos optimizada');
    
  } catch (error) {
    console.error('❌ Error en limpieza mensual:', error);
  }
});

console.log('✅ Sistema de mantenimiento programado iniciado');

module.exports = cron;