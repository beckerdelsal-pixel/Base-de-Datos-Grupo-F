# 🚀 Plataforma Crowdfunding - Oracle 21c XE

Sistema completo de crowdfunding con backend Node.js + Oracle 21c XE y frontend HTML/CSS/JS.

## 📋 Requisitos

### Software Necesario
1. **Oracle Database 21c Express Edition (XE)**
2. **Oracle SQL Developer** (opcional, para administración)
3. **Node.js 18+**
4. **Oracle Instant Client 21c**

### Configuración Oracle 21c XE
- Service: XEPDB1 (Pluggable Database)
- Usuario: crowdfunding_app
- Contraseña: crowdfunding123

## 🛠️ Instalación

### Paso 1: Configurar Base de Datos
```sql
-- En SQL Developer, conectar como SYSTEM a XEPDB1
CREATE USER crowdfunding_app IDENTIFIED BY crowdfunding123;
GRANT CONNECT, RESOURCE TO crowdfunding_app;
ALTER USER crowdfunding_app QUOTA UNLIMITED ON USERS;