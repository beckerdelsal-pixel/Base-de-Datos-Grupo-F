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

// REGISTRO
async function registrarUsuario(e) {
    if (e) e.preventDefault();
    console.log("Iniciando proceso de registro...");

    // 1. Capturamos los valores de texto
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-correo').value;
    const password = document.getElementById('reg-contraseña').value;

    // 2. Capturamos el valor del Radio Button seleccionado (rol)
    const radioSeleccionado = document.querySelector('input[name="tipo_usuario"]:checked');
    const rol = radioSeleccionado ? radioSeleccionado.value : null;

    if (!rol) {
        alert("Por favor, selecciona si eres Inversionista o Emprendedor.");
        return;
    }

    try {
        console.log("Enviando datos de registro:", { nombre, email, rol });
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });

        const data = await response.json();

        if (response.ok) {
            alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
            window.location.href = 'login.html';
        } else {
            alert('Error en el registro: ' + (data.message || 'Datos inválidos'));
        }
    } catch (err) {
        console.error('Error de conexión:', err);
        alert('No se pudo conectar con el servidor.');
    }
}

async function iniciarSesion(e) {
    if (e) e.preventDefault();
    console.log("Iniciando proceso de login...");

    // Verificamos que los elementos existan antes de leer su valor
    const inputEmail = document.getElementById('correo');
    const inputPass = document.getElementById('contraseña');

    if (!inputEmail || !inputPass) {
        console.error("ERROR: No se encontraron los campos 'correo' o 'contraseña' en el HTML.");
        alert("Error interno: Los IDs del formulario no coinciden.");
        return;
    }

    const email = inputEmail.value;
    const password = inputPass.value;

    try {
        console.log("Enviando petición a:", `${API_URL}/auth/login`);
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log("Respuesta del servidor:", data);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.user.nombre);
            localStorage.setItem('userId', data.user.id);
            
            console.log("Login exitoso. Redirigiendo a:", data.user.rol);
            
            // Redirección
            if (data.user.rol === 'inversionista') {
                window.location.href = 'dashboard-inversionista.html';
            } else {
                window.location.href = 'dashboard-emprendedor.html';
            }
        } else {
            alert('Error: ' + (data.message || 'Credenciales incorrectas'));
        }
    } catch (err) {
        console.error('Error total en el fetch:', err);
        alert('Error de conexión con el servidor. Revisa los logs de Render.');
    }
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