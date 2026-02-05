// --- 1. CONFIGURACIÓN GLOBAL ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? 'http://localhost:3000/api' : `${window.location.origin}/api`;

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
    const contenedor = document.getElementById('contenedor-proyectos');
    if (!contenedor) return; // Si no estamos en un dashboard, salir

    try {
        const response = await fetch(`${API_URL}/proyectos`);
        const proyectos = await response.json();

        contenedor.innerHTML = ''; // Limpiar cargando...
        
        proyectos.forEach(p => {
            const porcentaje = Math.min((p.actual / p.meta) * 100, 100).toFixed(1);
            contenedor.innerHTML += `
                <div class="proyecto-card">
                    <h3>${p.nombre}</h3>
                    <p>${p.descripcion}</p>
                    <div class="meta-info">
                        <span>Meta: $${p.meta}</span>
                        <span>Progreso: ${porcentaje}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${porcentaje}%"></div>
                    </div>
                    <button class="btn-invertir">Ver Detalles</button>
                </div>
            `;
        });
    } catch (err) { 
        contenedor.innerHTML = '<p>Error al cargar proyectos.</p>';
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
});