-- 1. Borrar las tablas existentes para resetear la estructura
-- (¡Cuidado! Esto borra los datos que hubiera en esas tablas)
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 2. Crear tabla de Usuarios (Estructura correcta)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('inversionista', 'emprendedor')),
    saldo DECIMAL(12,2) DEFAULT 0.00,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla de Proyectos (Estructura correcta)
CREATE TABLE proyectos (
    id SERIAL PRIMARY KEY,
    emprendedor_id INTEGER REFERENCES usuarios(id),
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    meta DECIMAL(12,2) NOT NULL,
    actual DECIMAL(12,2) DEFAULT 0.00,
    categoria VARCHAR(50),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insertar datos de prueba
INSERT INTO proyectos (nombre, descripcion, meta, actual, categoria) 
VALUES 
('Eco-Energía Solar', 'Sistema de paneles solares portátiles para zonas rurales.', 5000.00, 1200.00, 'Ecología'),
('App Delivery Local', 'Plataforma para conectar pequeños comercios con repartidores de barrio.', 3000.00, 450.00, 'Tecnología');

-- 5. Verificar que todo está ahí
SELECT * FROM proyectos;

