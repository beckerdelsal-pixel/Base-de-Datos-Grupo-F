# 🚀 CrowdBoost - Plataforma de Crowdfunding en la Nube

Una plataforma completa de crowdfunding 100% funcional, desplegada en la nube con Render.com.

## ✨ Características

### 🔐 Autenticación y Usuarios
- Registro de usuarios (Emprendedores/Inversores)
- Login seguro con JWT
- Perfiles de usuario personalizados
- Sistema de saldo para inversores

### 💼 Gestión de Proyectos
- Creación de proyectos de crowdfunding
- Categorización de proyectos
- Seguimiento de metas y recaudación
- Fechas límite configurables

### 💰 Sistema de Inversiones
- Inversión en proyectos activos
- Transacciones seguras
- Seguimiento de inversiones
- Saldo y recargas

### 📊 Dashboard Personalizados
- Dashboard para emprendedores
- Dashboard para inversores
- Estadísticas en tiempo real
- Proyectos recomendados

### 🌐 Características Web
- Diseño responsive y moderno
- Búsqueda en tiempo real
- Notificaciones interactivas
- API RESTful completa

## 🚀 Despliegue Rápido

### Opción 1: Render.com (Recomendado - Gratis)
1. **Crear cuenta en [render.com](https://render.com)**
2. **Crear nueva base de datos PostgreSQL**:
   - Nombre: `crowdfunding-db`
   - Database: `crowdfunding`
   - Plan: Free
3. **Crear nuevo Web Service**:
   - Conectar repositorio de GitHub
   - Configurar:
     - Build Command: `npm install`
     - Start Command: `node server.js`
     - Root Directory: `backend`
4. **Agregar variables de entorno**: