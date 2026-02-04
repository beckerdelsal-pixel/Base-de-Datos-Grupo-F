/* =========================================
   1. CONFIGURACIÓN API
   ========================================= */
const API_URL = 'http://localhost:3000/api'; // URL de tu backend

/* =========================================
   2. FUNCIONES GLOBALES (Loader y UI)
   ========================================= */
function mostrarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.remove("loader-hidden");
}

function ocultarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.add("loader-hidden");
}

function seguridadLoader() {
    setTimeout(() => {
        const loader = document.getElementById("loader-wrapper");
        if (loader && !loader.classList.contains("loader-hidden")) {
            console.warn("⚠️ El loader tardó demasiado. Forzando cierre de seguridad.");
            ocultarLoader();
        }
    }, 5000);
}

window.addEventListener("load", () => {
    setTimeout(ocultarLoader, 500);
    seguridadLoader();
});

/* =========================================
   3. FUNCIONES DE AUTENTICACIÓN (CONEXIÓN REAL)
   ========================================= */

// REGISTRO - Conexión con Oracle
async function registrarUsuario(event) {
    event.preventDefault();
    
    const form = event.target.closest('form');
    if (!form.checkValidity()) {
        alert("Por favor, completa todos los campos correctamente.");
        return;
    }
    
    const tipoRadio = form.querySelector('input[name="tipo_usuario"]:checked');
    const nombre = form.querySelector('input[type="text"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    
    if (!tipoRadio) {
        alert("Por favor, selecciona un rol (Inversionista o Emprendedor).");
        return;
    }
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre: nombre,
                email: email,
                password: password,
                tipo_usuario: tipoRadio.value === 'inversionista' ? 'inversor' : 'emprendedor'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert("✅ Registro exitoso! Por favor inicia sesión.");
            window.location.href = 'login.html';
        } else {
            alert(`❌ Error: ${data.error || data.errors?.[0]?.msg || 'Error en el registro'}`);
            ocultarLoader();
        }
    } catch (error) {
        console.error('Error:', error);
        alert("❌ Error de conexión con el servidor");
        ocultarLoader();
    }
}

// LOGIN - Conexión con Oracle
async function iniciarSesion(event) {
    event.preventDefault();
    
    const form = event.target.closest('form');
    if (!form.checkValidity()) {
        alert("Por favor, completa todos los campos.");
        return;
    }
    
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Guardar token y datos de usuario
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRol', data.user.tipo_usuario);
            localStorage.setItem('isLoggedIn', 'true');
            
            // Redirigir según el rol
            if (data.user.tipo_usuario === 'emprendedor') {
                window.location.href = 'dashboard-emprendedor.html';
            } else {
                window.location.href = 'dashboard-inversionista.html';
            }
        } else {
            alert(`❌ Error: ${data.error || 'Credenciales incorrectas'}`);
            ocultarLoader();
        }
    } catch (error) {
        console.error('Error:', error);
        alert("❌ Error de conexión con el servidor");
        ocultarLoader();
    }
}

// Cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRol');
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'index.html';
}

// Verificar autenticación
function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Si no está autenticado y está en un dashboard, redirigir al login
        if (window.location.pathname.includes('dashboard')) {
            window.location.href = 'login.html';
        }
    } else {
        // Si está autenticado, cargar datos del usuario
        cargarDatosUsuario();
    }
}

// Cargar datos del usuario
function cargarDatosUsuario() {
    const userData = localStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        
        // Actualizar nombre en los dashboards
        const userElements = document.querySelectorAll('.user-name');
        userElements.forEach(el => {
            el.textContent = `Hola, ${user.nombre} ${user.tipo_usuario === 'emprendedor' ? '🚀' : '💰'}`;
        });
        
        // Cargar datos específicos del dashboard
        if (user.tipo_usuario === 'emprendedor') {
            cargarDashboardEmprendedor();
        } else {
            cargarDashboardInversor();
        }
    }
}

/* =========================================
   4. FUNCIONES PARA DASHBOARD EMPRENDEDOR
   ========================================= */

async function cargarDashboardEmprendedor() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        mostrarLoader();
        
        const response = await fetch(`${API_URL}/dashboard/emprendedor`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            actualizarUIEmprendedor(data);
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    } finally {
        ocultarLoader();
    }
}

function actualizarUIEmprendedor(data) {
    // Actualizar estadísticas
    const statsContainer = document.querySelector('.perfil-emprendedor');
    if (statsContainer && data.estadisticas) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>Proyectos Totales</h3>
                <p class="valor">${data.estadisticas.TOTAL_PROYECTOS || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Total Recaudado</h3>
                <p class="valor">$${data.estadisticas.TOTAL_RECAUDADO_GLOBAL || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Completados</h3>
                <p class="valor">${data.estadisticas.PROYECTOS_COMPLETADOS || 0}</p>
            </div>
        `;
    }
    
    // Actualizar lista de proyectos si existe
    const proyectosContainer = document.querySelector('.lista-proyectos');
    if (proyectosContainer && data.proyectos) {
        proyectosContainer.innerHTML = `
            <h3>Mis Proyectos</h3>
            ${data.proyectos.length > 0 ? 
                data.proyectos.map(p => `
                    <div class="proyecto-card">
                        <h4>${p.TITULO}</h4>
                        <p>${p.DESCRIPCION?.substring(0, 100)}...</p>
                        <p><strong>Estado:</strong> ${p.ESTADO}</p>
                        <p><strong>Recaudado:</strong> $${p.FONDOS_RECAUDADOS || 0} / $${p.META_FINANCIERA}</p>
                        <p><strong>Inversiones:</strong> ${p.TOTAL_INVERSIONES || 0}</p>
                        <p><strong>Días restantes:</strong> ${p.DIAS_RESTANTES > 0 ? p.DIAS_RESTANTES : 'Expirado'}</p>
                    </div>
                `).join('') : 
                '<p>No tienes proyectos creados aún.</p>'
            }
        `;
    }
}

// Crear nuevo proyecto
async function publicarProyecto() {
    const nombre = document.getElementById('nombre-p')?.value;
    const meta = document.getElementById('meta-p')?.value;
    const descripcion = document.getElementById('desc-p')?.value;
    
    if (!nombre || !meta || !descripcion) {
        alert("Por favor, completa todos los campos.");
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Debes iniciar sesión primero.");
        return;
    }
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/proyectos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                titulo: nombre,
                meta_financiera: parseFloat(meta),
                descripcion: descripcion,
                fecha_limite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 días desde hoy
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert("✅ Proyecto creado exitosamente!");
            document.getElementById('seccion-nuevo-proyecto').style.display = 'none';
            
            // Limpiar campos
            document.getElementById('nombre-p').value = '';
            document.getElementById('meta-p').value = '';
            document.getElementById('desc-p').value = '';
            
            // Recargar datos del dashboard
            cargarDashboardEmprendedor();
        } else {
            alert(`❌ Error: ${data.error || 'Error al crear el proyecto'}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert("❌ Error de conexión");
    } finally {
        ocultarLoader();
    }
}

/* =========================================
   5. FUNCIONES PARA DASHBOARD INVERSOR
   ========================================= */

async function cargarDashboardInversor() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        mostrarLoader();
        
        const response = await fetch(`${API_URL}/dashboard/inversor`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            actualizarUIInversor(data);
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    } finally {
        ocultarLoader();
    }
}

function actualizarUIInversor(data) {
    // Actualizar estadísticas
    const statsContainer = document.querySelector('.perfil-inversionista');
    if (statsContainer && data.estadisticas) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>Total Invertido</h3>
                <p class="valor">$${data.estadisticas.TOTAL_INVERTIDO || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Apoyados</h3>
                <p class="valor">${data.estadisticas.TOTAL_INVERSIONES || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Diferentes</h3>
                <p class="valor">${data.estadisticas.PROYECTOS_DIFERENTES || 0}</p>
            </div>
        `;
    }
    
    // Actualizar lista de inversiones
    const inversionesContainer = document.querySelector('.lista-inversiones');
    if (inversionesContainer && data.inversiones) {
        inversionesContainer.innerHTML = `
            <h3>Seguimiento de Inversiones</h3>
            ${data.inversiones.length > 0 ? 
                data.inversiones.map(i => `
                    <div class="inversion-card">
                        <h4>${i.PROYECTO_TITULO}</h4>
                        <p><strong>Emprendedor:</strong> ${i.NOMBRE_EMPRENDEDOR}</p>
                        <p><strong>Monto:</strong> $${i.MONTO}</p>
                        <p><strong>Fecha:</strong> ${new Date(i.FECHA_INVERSION).toLocaleDateString()}</p>
                        <p><strong>Estado Proyecto:</strong> ${i.PROYECTO_ESTADO}</p>
                    </div>
                `).join('') : 
                '<p>Aún no tienes inversiones.</p>'
            }
        `;
    }
}

/* =========================================
   6. FUNCIONES PARA LA PÁGINA PRINCIPAL
   ========================================= */

// Cargar estadísticas globales
async function cargarEstadisticasGlobales() {
    try {
        const response = await fetch(`${API_URL}/proyectos`);
        const proyectos = await response.json();
        
        // Calcular estadísticas
        const totalUsuarios = 15000; // Esto debería venir de una API real
        const proyectosFinanciados = proyectos.filter(p => p.ESTADO === 'completado').length;
        const capitalMovilizado = proyectos.reduce((sum, p) => sum + (p.FONDOS_RECAUDADOS || 0), 0);
        
        // Actualizar UI
        document.getElementById('stat-users').textContent = totalUsuarios.toLocaleString();
        document.getElementById('stat-funded').textContent = proyectosFinanciados;
        document.getElementById('stat-money').textContent = `$${(capitalMovilizado / 1000000).toFixed(1)}M`;
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Cargar proyectos en la página principal
async function cargarProyectosHome() {
    try {
        const response = await fetch(`${API_URL}/proyectos?estado=activo&limit=6`);
        const proyectos = await response.json();
        
        const container = document.getElementById('proyectos-container');
        if (!container) return;
        
        container.innerHTML = proyectos.map(p => `
            <div class="tarjeta">
                <div class="tarjeta-img" style="background-color: #${Math.floor(Math.random()*16777215).toString(16)}"></div>
                <div class="tarjeta-contenido">
                    <h3>${p.TITULO}</h3>
                    <p>${p.DESCRIPCION?.substring(0, 100)}...</p>
                    <div class="tarjeta-metas">
                        <span>Recaudado: $${p.FONDOS_RECAUDADOS || 0}</span>
                        <span>Meta: $${p.META_FINANCIERA}</span>
                    </div>
                    <div class="progreso-contenedor">
                        <div class="progreso-barra" style="width: ${Math.min(100, ((p.FONDOS_RECAUDADOS || 0) / p.META_FINANCIERA) * 100)}%"></div>
                    </div>
                    <p><small>Por: ${p.NOMBRE_EMPRENDEDOR}</small></p>
                    <button class="boton-invertir" onclick="verDetalleProyecto(${p.ID_PROYECTO})">Ver Detalles</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando proyectos:', error);
    }
}

/* =========================================
   7. SISTEMA DE BÚSQUEDA DINÁMICA
   ========================================= */

async function buscarProyectos(texto) {
    try {
        const response = await fetch(`${API_URL}/proyectos/buscar?q=${encodeURIComponent(texto)}`);
        const proyectos = await response.json();
        
        const contenedorResultados = document.getElementById('resultados-busqueda');
        if (!contenedorResultados) return;
        
        contenedorResultados.innerHTML = '';
        
        if (proyectos.length > 0) {
            contenedorResultados.style.display = 'block';
            proyectos.forEach(p => {
                const div = document.createElement('div');
                div.className = 'resultado-item';
                div.innerHTML = `
                    <span class="categoria">${p.CATEGORIA || 'General'}</span>
                    <span>${p.TITULO}</span>
                    <small>Por: ${p.NOMBRE_EMPRENDEDOR}</small>
                `;
                div.onclick = () => {
                    window.location.href = `#proyecto-${p.ID_PROYECTO}`;
                    contenedorResultados.style.display = 'none';
                };
                contenedorResultados.appendChild(div);
            });
        } else {
            contenedorResultados.style.display = 'none';
        }
    } catch (error) {
        console.error('Error en búsqueda:', error);
    }
}

/* =========================================
   8. INICIALIZACIÓN
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    // Verificar autenticación
    verificarAutenticacion();
    
    // Cargar estadísticas en la página principal
    if (document.getElementById('stat-users')) {
        cargarEstadisticasGlobales();
        cargarProyectosHome();
    }
    
    // Configurar búsqueda
    const inputBusqueda = document.getElementById('input-busqueda');
    if (inputBusqueda) {
        let timeout;
        inputBusqueda.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (e.target.value.length > 0) {
                    buscarProyectos(e.target.value);
                } else {
                    const resultados = document.getElementById('resultados-busqueda');
                    if (resultados) resultados.style.display = 'none';
                }
            }, 300);
        });
    }
    
    // Configurar formularios
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (form.action.includes('login') || form.getAttribute('action') === 'login') {
                iniciarSesion(e);
            } else if (form.action.includes('register') || form.querySelector('input[name="tipo_usuario"]')) {
                registrarUsuario(e);
            }
        });
    });
    
    // Configurar botón de cerrar sesión
    const logoutButtons = document.querySelectorAll('[onclick*="logout"], [href*="logout"]');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    });
});