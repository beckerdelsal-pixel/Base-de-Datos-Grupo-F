// --- 1. CONFIGURACIÓN GLOBAL ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? 'http://localhost:3000/api' : `${window.location.origin}/api`;

// Forzar desaparición del loader si tarda más de 3 segundos
setTimeout(() => {
    const loader = document.getElementById('loader-wrapper');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
}, 3000);

// --- 2. FUNCIONES DE AUTENTICACIÓN ---
async function iniciarSesion(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('correo').value;
    const password = document.getElementById('contraseña').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.user.nombre);
            localStorage.setItem('userId', data.user.id || 1); // Guardamos el ID del usuario
            window.location.href = data.user.rol === 'inversionista' ? 'dashboard-inversionista.html' : 'dashboard-emprendedor.html';
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) { alert('Error de conexión con el servidor'); }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- 3. FUNCIONES DE PROYECTOS ---

// Enviar nuevo proyecto a la DB
async function crearProyecto(e) {
    if (e) e.preventDefault();

    const proyecto = {
        nombre: document.getElementById('proj-nombre').value,
        descripcion: document.getElementById('proj-descripcion').value,
        meta: parseFloat(document.getElementById('proj-meta').value),
        categoria: document.getElementById('proj-categoria').value,
        emprendedor_id: localStorage.getItem('userId') || 1 // Usar ID real del login
    };

    try {
        const response = await fetch(`${API_URL}/proyectos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proyecto)
        });

        if (response.ok) {
            alert('¡Proyecto publicado con éxito! 🎉');
            window.location.href = 'dashboard-emprendedor.html'; // Recargar para ver cambios
        } else {
            alert('No se pudo guardar el proyecto.');
        }
    } catch (err) { alert('Error al conectar con el servidor'); }
}

// Cargar y mostrar proyectos en el Dashboard
async function cargarProyectos() {
    console.log("Intentando cargar proyectos..."); // Para ver en consola
    const contenedor = document.getElementById('contenedor-proyectos');
    const loader = document.getElementById('loader-wrapper');

    try {
        const response = await fetch(`${API_URL}/proyectos`);
        const proyectos = await response.json();
        console.log("Proyectos recibidos:", proyectos);

        if (contenedor) {
            if (proyectos.length === 0) {
                contenedor.innerHTML = '<p>No hay proyectos disponibles aún.</p>';
            } else {
                contenedor.innerHTML = ''; // Limpiar
                proyectos.forEach(p => {
                    // ... tu código actual para crear las cards ...
                    contenedor.innerHTML += `<div class="card"><h3>${p.nombre}</h3></div>`; 
                });
            }
        }
    } catch (err) {
        console.error("Error al cargar:", err);
    } finally {
        // ESTO ES LO MÁS IMPORTANTE: El loader se quita sí o sí, falle o funcione
        if (loader) loader.style.display = 'none';
    }
}

// --- 4. INICIALIZADOR DE EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Manejo del Login
    const formLogin = document.getElementById('login-form');
    if (formLogin) formLogin.addEventListener('submit', iniciarSesion);

    // 2. Manejo de Creación de Proyectos
    const formProyecto = document.getElementById('form-crear-proyecto');
    if (formProyecto) formProyecto.addEventListener('submit', crearProyecto);

    // 3. Cargar Proyectos automáticamente si hay un contenedor
    if (document.getElementById('contenedor-proyectos')) {
        cargarProyectos();
    }

    // 4. Mostrar nombre de usuario si existe
    const userDisplay = document.querySelector('.user-name');
    if (userDisplay && localStorage.getItem('userName')) {
        userDisplay.textContent = `Hola, ${localStorage.getItem('userName')}`;
    }

    setTimeout(() => {
    const loader = document.getElementById('loader-wrapper');
    if (loader) loader.style.display = 'none';
}, 5000);
});