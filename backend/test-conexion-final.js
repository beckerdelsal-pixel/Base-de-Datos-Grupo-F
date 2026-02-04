const oracledb = require('oracledb');
require('dotenv').config();

async function testConexion() {
  console.log('============================================');
  console.log('   TEST DE CONEXIÓN ORACLE 21c XE - PDB');
  console.log('============================================\n');
  
  console.log('📋 Configuración cargada:');
  console.log(`   Usuario: ${process.env.DB_USER}`);
  console.log(`   Connect: ${process.env.DB_CONNECT_STRING}`);
  
  let connection;
  
  try {
    console.log('\n🔗 Conectando a Oracle...');
    
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    
    console.log('✅ ¡CONEXIÓN EXITOSA!\n');
    
    // Información del PDB
    const info = await connection.execute(`
      SELECT 
        SYS_CONTEXT('USERENV', 'CON_NAME') as pdb,
        SYS_CONTEXT('USERENV', 'DB_NAME') as database,
        USER as usuario,
        TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI:SS') as fecha,
        (SELECT version FROM v$instance) as version
      FROM dual
    `);
    
    console.log('📊 INFORMACIÓN DE CONEXIÓN:');
    console.log(`   PDB: ${info.rows[0][0]}`);
    console.log(`   Base de Datos: ${info.rows[0][1]}`);
    console.log(`   Usuario: ${info.rows[0][2]}`);
    console.log(`   Fecha/Hora: ${info.rows[0][3]}`);
    console.log(`   Versión Oracle: ${info.rows[0][4]}`);
    
    // Verificar tablas existentes
    const tablas = await connection.execute(`
      SELECT table_name, num_rows
      FROM user_tables
      ORDER BY table_name
    `);
    
    console.log('\n📋 TABLAS EXISTENTES:');
    if (tablas.rows.length === 0) {
      console.log('   No hay tablas creadas aún.');
      console.log('   Ejecuta: node setup-database.js');
    } else {
      tablas.rows.forEach(row => {
        console.log(`   - ${row[0]} (${row[1] || 0} filas)`);
      });
    }
    
    await connection.close();
    
    console.log('\n============================================');
    console.log('   ✅ TEST COMPLETADO SATISFACTORIAMENTE');
    console.log('============================================');
    console.log('\n🎉 ¡Tu conexión Oracle 21c XE está lista!');
    console.log('\n🚀 Próximos pasos:');
    console.log('1. Crear tablas: node setup-database.js');
    console.log('2. Iniciar servidor: npm run dev');
    console.log('3. Probar API: http://localhost:3000/api/proyectos');
    
  } catch (err) {
    console.error('\n❌ ERROR DE CONEXIÓN:', err.message);
    
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('1. Verifica que Oracle 21c XE esté corriendo');
    console.log('2. Usuario debe existir en XEPDB1 (no en XE)');
    console.log('3. Ejecuta en SQL Developer (como SYSTEM a XEPDB1):');
    console.log(`
    -- Crear usuario si no existe
    CREATE USER crowdfunding_app IDENTIFIED BY crowdfunding123;
    GRANT CONNECT, RESOURCE TO crowdfunding_app;
    ALTER USER crowdfunding_app QUOTA UNLIMITED ON USERS;
    `);
  }
}

testConexion();