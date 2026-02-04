const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // En desarrollo, usar ethereal.email para testing
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
      this.isTest = true;
      this.createTestAccount();
    } else {
      this.isTest = false;
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_PORT === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }
  }
  
  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('📧 Usando cuenta de prueba de email:', testAccount.user);
    } catch (error) {
      console.error('Error creando cuenta de prueba de email:', error);
    }
  }
  
  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: `"CrowdBoost 🚀" <${process.env.EMAIL_FROM || 'noreply@crowdboost.com'}>`,
      to: user.email,
      subject: `¡Bienvenido a CrowdBoost, ${user.nombre}! 🎉`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin-bottom: 10px;">🎉 ¡Bienvenido a CrowdBoost!</h1>
            <p style="color: #6B7280; font-size: 18px;">La plataforma donde los sueños encuentran financiamiento</p>
          </div>
          
          <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 25px;">
            <h2 style="color: #1F2937; margin-bottom: 20px;">Hola ${user.nombre},</h2>
            
            <p style="color: #4B5563; line-height: 1.6; margin-bottom: 20px;">
              ¡Estamos emocionados de tenerte en nuestra comunidad! 
              Tu cuenta ha sido creada exitosamente como <strong>${user.tipo_usuario === 'emprendedor' ? 'Emprendedor 🚀' : 'Inversor 💰'}</strong>.
            </p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #374151; margin-top: 0;">📋 Detalles de tu cuenta:</h3>
              <ul style="color: #4B5563; padding-left: 20px;">
                <li><strong>Nombre:</strong> ${user.nombre}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Rol:</strong> ${user.tipo_usuario === 'emprendedor' ? 'Emprendedor' : 'Inversor'}</li>
                <li><strong>Saldo inicial:</strong> $${user.saldo || 0}</li>
                <li><strong>Fecha de registro:</strong> ${new Date().toLocaleDateString('es-ES')}</li>
              </ul>
            </div>
            
            <div style="margin: 25px 0;">
              <h3 style="color: #374151;">🎯 ¿Qué puedes hacer ahora?</h3>
              ${user.tipo_usuario === 'emprendedor' 
                ? `<ul style="color: #4B5563;">
                    <li>🚀 Crear tu primer proyecto de crowdfunding</li>
                    <li>🎯 Establecer metas realistas de financiamiento</li>
                    <li>📊 Compartir tu visión con la comunidad</li>
                    <li>💬 Recibir feedback de inversores</li>
                   </ul>`
                : `<ul style="color: #4B5563;">
                    <li>💰 Explorar proyectos innovadores</li>
                    <li>📈 Realizar inversiones seguras</li>
                    <li>👥 Seguir a emprendedores talentosos</li>
                    <li>📊 Diversificar tu portafolio</li>
                   </ul>`
              }
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 50px; 
                        font-weight: bold; 
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                        transition: transform 0.3s ease;">
                Ir a mi Dashboard
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #6B7280; font-size: 14px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p>© ${new Date().getFullYear()} CrowdBoost. Todos los derechos reservados.</p>
            <p>Si tienes preguntas, contáctanos en <a href="mailto:soporte@crowdboost.com" style="color: #4F46E5;">soporte@crowdboost.com</a></p>
            <p style="margin-top: 10px;">
              <a href="#" style="color: #4F46E5; margin: 0 10px;">Política de Privacidad</a> | 
              <a href="#" style="color: #4F46E5; margin: 0 10px;">Términos de Servicio</a> | 
              <a href="#" style="color: #4F46E5; margin: 0 10px;">Centro de Ayuda</a>
            </p>
          </div>
        </div>
      `
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (this.isTest) {
        console.log('📧 Email de prueba enviado. Preview URL:', nodemailer.getTestMessageUrl(info));
      } else {
        console.log(`✅ Email de bienvenida enviado a ${user.email}`);
      }
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de bienvenida:', error);
      return { success: false, error: error.message };
    }
  }
  
  async sendInvestmentNotification(investment, project, investor, entrepreneur) {
    // Email para el emprendedor
    const entrepreneurMail = {
      from: `"CrowdBoost 🚀" <${process.env.EMAIL_FROM || 'noreply@crowdboost.com'}>`,
      to: entrepreneur.email,
      subject: `🎉 ¡Nueva inversión en tu proyecto "${project.titulo}"!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Felicidades!</h1>
          <p>${investor.nombre} ha invertido <strong>$${investment.monto}</strong> en tu proyecto "${project.titulo}".</p>
          <p>Total recaudado hasta ahora: <strong>$${project.fondos_recaudados}</strong></p>
          <p>¡Sigue compartiendo tu proyecto para alcanzar tu meta!</p>
        </div>
      `
    };
    
    // Email para el inversor
    const investorMail = {
      from: `"CrowdBoost 🚀" <${process.env.EMAIL_FROM || 'noreply@crowdboost.com'}>`,
      to: investor.email,
      subject: `✅ Confirmación de inversión en "${project.titulo}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Inversión confirmada!</h1>
          <p>Has invertido <strong>$${investment.monto}</strong> en el proyecto "${project.titulo}".</p>
          <p>Emprendedor: <strong>${entrepreneur.nombre}</strong></p>
          <p>Tu inversión está activa y podrás seguir el progreso del proyecto desde tu dashboard.</p>
        </div>
      `
    };
    
    try {
      await this.transporter.sendMail(entrepreneurMail);
      await this.transporter.sendMail(investorMail);
      console.log(`✅ Emails de inversión enviados`);
    } catch (error) {
      console.error('❌ Error enviando emails de inversión:', error);
    }
  }
  
  async sendProjectUpdate(project, update, subscribers) {
    // Implementar envío de actualizaciones a suscriptores
  }
  
  async sendPasswordReset(email, resetToken) {
    // Implementar recuperación de contraseña
  }
}

// Singleton instance
module.exports = new EmailService();