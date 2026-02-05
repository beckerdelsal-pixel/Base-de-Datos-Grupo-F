/* =========================================
   CONFIGURACIÓN PARA PRODUCCIÓN EN LA NUBE
   ========================================= */

// Detectar entorno automáticamente
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '';

// Configurar URLs según el entorno
const API_BASE_URL = isLocal 
    ? 'http://localhost:3000'
    : window.location.origin; // Usar el mismo dominio en producción

const API_URL = `${API_BASE_URL}/api`;

console.log(`🌐 Entorno: ${isLocal ? 'Desarrollo' : 'Producción'}`);
console.log(`🔗 API URL: ${API_URL}`);

/* =========================================
   MANEJO DE ERRORES MEJORADO
   ========================================= */

// Interceptor de fetch para manejo de errores global
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const startTime = Date.now();
    const [url, options = {}] = args;
    
    // Agregar headers por defecto
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token && !url.includes('/auth/login') && !url.includes('/auth/register')) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fetchOptions = {
        ...options,
        headers
    };
    
    try {
        const response = await originalFetch(url, fetchOptions);
        const duration = Date.now() - startTime;
        
        // Log en desarrollo
        if (isLocal) {
            console.log(`📡 ${options.method || 'GET'} ${url} - ${response.status} (${duration}ms)`);
        }
        
        // Si la respuesta no es OK, manejar error
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { error: `HTTP ${response.status}` };
            }
            
            // Si es error de autenticación, redirigir a login
            if (response.status === 401) {
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('registro.html')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('userRol');
                    showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
                    
                    // Redirigir después de 2 segundos
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }
            }
            
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        
        return response;
    } catch (error) {
        console.error('❌ Fetch error:', error);
        
        // Mostrar notificación al usuario
        if (!error.message.includes('Failed to fetch')) {
            showNotification(`Error: ${error.message}`, 'error');
        } else {
            showNotification('Error de conexión. Verifica tu internet.', 'error');
        }
        
        throw error;
    }
};

/* =========================================
   FUNCIONES DE AUTENTICACIÓN
   ========================================= */

// Registrar usuario
async function registrarUsuario(event) {
    event.preventDefault();
    
    const form = event.target.closest('form');
    if (!form) return;
    
    const tipoRadio = form.querySelector('input[name="tipo_usuario"]:checked');
    const nombre = form.querySelector('input[type="text"]')?.value;
    const email = form.querySelector('input[type="email"]')?.value;
    const password = form.querySelector('input[type="password"]')?.value;
    
    if (!tipoRadio || !nombre || !email || !password) {
        showNotification('Por favor, completa todos los campos.', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showNotification('La contraseña debe tener al menos 6 caracteres.', 'warning');
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
                nombre: nombre.trim(),
                email: email.trim().toLowerCase(),
                password: password,
                tipo_usuario: tipoRadio.value === 'inversionista' ? 'inversor' : 'emprendedor'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ ¡Registro exitoso! Redirigiendo al login...', 'success');
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            
        } else {
            showNotification(`❌ ${data.error || data.errors?.[0]?.msg || 'Error en el registro'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error de conexión con el servidor', 'error');
    } finally {
        ocultarLoader();
    }
}

// Iniciar sesión
async function iniciarSesion(event) {
    event.preventDefault();
    
    const form = event.target.closest('form');
    if (!form) return;
    
    const email = form.querySelector('input[type="email"]')?.value;
    const password = form.querySelector('input[type="password"]')?.value;
    
    if (!email || !password) {
        showNotification('Por favor, completa todos los campos.', 'warning');
        return;
    }
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email.trim().toLowerCase(),
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Guardar datos en localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRol', data.user.tipo_usuario);
            localStorage.setItem('lastLogin', new Date().toISOString());
            
            showNotification(`✅ ¡Bienvenido, ${data.user.nombre}!`, 'success');
            
            // Redirigir según rol
            setTimeout(() => {
                if (data.user.tipo_usuario === 'emprendedor') {
                    window.location.href = 'dashboard-emprendedor.html';
                } else {
                    window.location.href = 'dashboard-inversionista.html';
                }
            }, 1500);
            
        } else {
            showNotification(`❌ ${data.error || 'Credenciales incorrectas'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error de conexión con el servidor', 'error');
    } finally {
        ocultarLoader();
    }
}

// Cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRol');
    localStorage.removeItem('lastLogin');
    
    showNotification('✅ Sesión cerrada exitosamente', 'success');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Verificar autenticación
function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    
    // Si no hay token y está en un área protegida, redirigir
    if (!token && (currentPath.includes('dashboard'))) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Si hay token y está en login/registro, redirigir al dashboard
    if (token && (currentPath.includes('login.html') || currentPath.includes('registro.html'))) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.tipo_usuario === 'emprendedor') {
            window.location.href = 'dashboard-emprendedor.html';
        } else {
            window.location.href = 'dashboard-inversionista.html';
        }
        return false;
    }
    
    return !!token;
}

// Verificar y renovar token si es necesario
async function verificarToken() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('token', data.token);
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            return true;
        }
    } catch (error) {
        console.error('Error verificando token:', error);
    }
    
    return false;
}

/* =========================================
   FUNCIONES DE INTERFAZ
   ========================================= */

// Mostrar notificación
function showNotification(message, type = 'info') {
    // Remover notificaciones anteriores
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Cargar estadísticas globales
async function cargarEstadisticasGlobales() {
    try {
        const response = await fetch(`${API_URL}/stats/global`);
        const data = await response.json();
        
        if (data.success) {
            const stats = data.data;
            
            // Actualizar estadísticas en la página
            const statUsers = document.getElementById('stat-users');
            const statFunded = document.getElementById('stat-funded');
            const statMoney = document.getElementById('stat-money');
            
            if (statUsers) {
                statUsers.textContent = (stats.usuarios?.total_usuarios || 15000).toLocaleString();
            }
            
            if (statFunded) {
                statFunded.textContent = stats.proyectos?.proyectos_financiados || '1,200+';
            }
            
            if (statMoney) {
                const capital = stats.proyectos?.capital_movilizado || 5200000;
                statMoney.textContent = `$${(capital / 1000000).toFixed(1)}M`;
            }
            
            // Animar los números
            animarContadores();
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        // Valores por defecto
        document.getElementById('stat-users').textContent = '15,000+';
        document.getElementById('stat-funded').textContent = '1,200+';
        document.getElementById('stat-money').textContent = '$5.2M';
    }
}

// Animación de contadores
function animarContadores() {
    const counters = document.querySelectorAll('.stat-item h2');
    counters.forEach(counter => {
        const target = parseInt(counter.textContent.replace(/,/g, '').replace('+', '').replace('$', '').replace('M', ''));
        const increment = target / 100;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Formatear el número
            let formatted;
            if (counter.id === 'stat-money') {
                formatted = `$${(current / 1000000).toFixed(1)}M`;
            } else if (counter.id === 'stat-users') {
                formatted = Math.floor(current).toLocaleString();
            } else {
                formatted = Math.floor(current).toLocaleString();
            }
            
            counter.textContent = formatted;
        }, 20);
    });
}

// Cargar proyectos destacados
async function cargarProyectosDestacados() {
    try {
        const response = await fetch(`${API_URL}/projects/featured`);
        const data = await response.json();
        
        const container = document.getElementById('proyectos-container');
        if (!container) return;
        
        if (data.success && data.data && data.data.length > 0) {
            container.innerHTML = data.data.map(proyecto => crearTarjetaProyecto(proyecto)).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <h3>No hay proyectos disponibles</h3>
                    <p>Sé el primero en crear un proyecto innovador!</p>
                    <a href="registro.html" class="boton-primario mt-4">Crear mi Proyecto</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        const container = document.getElementById('proyectos-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <h3>Error cargando proyectos</h3>
                    <p>Intenta recargar la página o vuelve más tarde.</p>
                </div>
            `;
        }
    }
}

// Crear tarjeta de proyecto
function crearTarjetaProyecto(proyecto) {
    const porcentaje = Math.min(100, ((proyecto.fondos_recaudados || 0) / proyecto.meta_financiera) * 100);
    const diasRestantes = proyecto.dias_restantes || Math.ceil((new Date(proyecto.fecha_limite) - new Date()) / (1000 * 60 * 60 * 24));
    
    // Colores por categoría
    const categoriasColores = {
        'tecnologia': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'ecologia': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'salud': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        'educacion': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        'arte': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'otros': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
    };
    
    const fondo = categoriasColores[proyecto.categoria] || categoriasColores.otros;
    
    return `
        <div class="tarjeta-proyecto fade-in">
            <div class="tarjeta-imagen" style="background: ${fondo};">
                ${proyecto.categoria ? `<span class="categoria-badge">${proyecto.categoria.toUpperCase()}</span>` : ''}
                ${diasRestantes <= 7 ? `<span class="categoria-badge" style="right: 1rem; left: auto; background: #ef4444; color: white;">¡PRONTO!</span>` : ''}
            </div>
            <div class="tarjeta-contenido">
                <h3>${proyecto.titulo || 'Proyecto sin título'}</h3>
                <p class="descripcion">${(proyecto.descripcion || '').substring(0, 120)}${proyecto.descripcion && proyecto.descripcion.length > 120 ? '...' : ''}</p>
                
                <div class="progreso-container">
                    <div class="progreso-bar" style="width: ${porcentaje}%"></div>
                </div>
                
                <div class="tarjeta-stats">
                    <div class="stat">
                        <span class="stat-value">$${(proyecto.fondos_recaudados || 0).toLocaleString()}</span>
                        <span class="stat-label">Recaudado</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${porcentaje.toFixed(0)}%</span>
                        <span class="stat-label">Completado</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${diasRestantes > 0 ? diasRestantes : 0}</span>
                        <span class="stat-label">Días restantes</span>
                    </div>
                </div>
                
                <div class="tarjeta-footer">
                    <span class="emprendedor">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(proyecto.nombre_emprendedor || 'Usuario')}&background=4F46E5&color=fff" 
                             alt="Avatar" class="avatar">
                        ${proyecto.nombre_emprendedor || 'Emprendedor'}
                    </span>
                    <button class="btn-invertir" onclick="verDetalleProyecto(${proyecto.id})">
                        ${porcentaje >= 100 ? 'Ver Resultados' : 'Ver Detalles'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Ver detalle de proyecto (placeholder)
function verDetalleProyecto(id) {
    showNotification(`Redirigiendo a proyecto #${id}...`, 'info');
    // En una implementación completa, redirigiría a una página de detalle
    console.log(`Ver proyecto ${id}`);
}

// Sistema de búsqueda en tiempo real
let searchTimeout;
async function buscarProyectos(query) {
    clearTimeout(searchTimeout);
    
    if (!query || query.length < 2) {
        ocultarResultadosBusqueda();
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_URL}/projects/search?q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();
            
            mostrarResultadosBusqueda(data.data || []);
        } catch (error) {
            console.error('Error en búsqueda:', error);
        }
    }, 300);
}

function mostrarResultadosBusqueda(proyectos) {
    const container = document.getElementById('resultados-busqueda');
    if (!container) return;
    
    if (proyectos && proyectos.length > 0) {
        container.innerHTML = proyectos.map(p => `
            <div class="resultado-item" onclick="seleccionarProyecto(${p.id})">
                <strong>${p.titulo}</strong>
                <small>${p.categoria || 'General'} • Por: ${p.nombre_emprendedor}</small>
                <span style="display: block; margin-top: 5px; font-size: 12px; color: #10B981;">
                    $${p.fondos_recaudados || 0} / $${p.meta_financiera} (${Math.round(((p.fondos_recaudados || 0) / p.meta_financiera) * 100)}%)
                </span>
            </div>
        `).join('');
        container.style.display = 'block';
    } else {
        container.innerHTML = '<div class="resultado-item">No se encontraron proyectos</div>';
        container.style.display = 'block';
    }
}

function ocultarResultadosBusqueda() {
    const container = document.getElementById('resultados-busqueda');
    if (container) {
        container.style.display = 'none';
    }
}

function seleccionarProyecto(id) {
    const input = document.getElementById('input-busqueda');
    if (input) {
        input.value = '';
    }
    ocultarResultadosBusqueda();
    verDetalleProyecto(id);
}

/* =========================================
   FUNCIONES PARA DASHBOARD EMPRENDEDOR
   ========================================= */

async function cargarDashboardEmprendedor() {
    if (!verificarAutenticacion()) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('❌ Sesión expirada', 'error');
        window.location.href = 'login.html';
        return;
    }
    
    mostrarLoader();
    
    try {
        console.log('🔍 Solicitando dashboard emprendedor...');
        const response = await fetch(`${API_URL}/dashboard/emprendedor`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📊 Status:', response.status);
        
        // Si es 404, el endpoint no existe
        if (response.status === 404) {
            showNotification('⚠️ Dashboard no disponible temporalmente', 'warning');
            
            // Cargar datos de prueba o redirigir
            const datosMock = {
                success: true,
                data: {
                    usuario: { nombre: 'Usuario Demo' },
                    estadisticas: { totalProyectos: 0, proyectosActivos: 0 },
                    proyectos: []
                }
            };
            actualizarDashboardEmprendedor(datosMock.data);
            return;
        }
        
        // Si es 403, no es emprendedor
        if (response.status === 403) {
            showNotification('🔁 Redirigiendo a dashboard de inversionista...', 'info');
            setTimeout(() => {
                window.location.href = 'dashboard-inversionista.html';
            }, 1500);
            return;
        }
        
        // Si es 500, error del servidor
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            actualizarDashboardEmprendedor(data.data);
        } else {
            showNotification('❌ ' + (data.error || 'Error cargando dashboard'), 'error');
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showNotification('❌ Error de conexión con el servidor', 'error');
    } finally {
        ocultarLoader();
    }
}

function actualizarDashboardEmprendedor(data) {
    // Actualizar nombre de usuario
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
        el.textContent = `Hola, ${data.usuario.nombre} 🚀`;
    });
    
    // Actualizar estadísticas
    const statsContainer = document.querySelector('.perfil-emprendedor');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>Proyectos Totales</h3>
                <p class="valor">${data.estadisticas.total_proyectos || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Total Recaudado</h3>
                <p class="valor">$${data.estadisticas.total_recaudado_global || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Completados</h3>
                <p class="valor">${data.estadisticas.proyectos_completados || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Necesitan Atención</h3>
                <p class="valor" style="color: ${data.estadisticas.proyectos_necesitan_atencion > 0 ? '#EF4444' : '#10B981'}">
                    ${data.estadisticas.proyectos_necesitan_atencion || 0}
                </p>
            </div>
        `;
    }
    
    // Actualizar lista de proyectos
    const proyectosContainer = document.querySelector('.lista-proyectos');
    if (proyectosContainer && data.proyectos) {
        if (data.proyectos.length > 0) {
            proyectosContainer.innerHTML = `
                <h3>Mis Proyectos Activos</h3>
                ${data.proyectos.map(p => `
                    <div class="proyecto-card">
                        <h4>${p.titulo}</h4>
                        <p>${p.descripcion}</p>
                        <p><strong>Estado:</strong> <span style="color: ${
                            p.estado === 'activo' ? '#10B981' : 
                            p.estado === 'completado' ? '#3B82F6' : 
                            p.estado === 'expirado' ? '#EF4444' : '#6B7280'
                        }">${p.estado}</span></p>
                        <p><strong>Recaudado:</strong> $${p.fondos_recaudados} / $${p.meta_financiera} (${p.porcentaje_completado}%)</p>
                        <p><strong>Inversiones:</strong> ${p.investors_count}</p>
                        <p><strong>Días restantes:</strong> ${p.dias_restantes > 0 ? p.dias_restantes : 'Expirado'}</p>
                        <div style="margin-top: 10px;">
                            <button class="boton-primario" style="padding: 5px 10px; font-size: 14px;" onclick="editarProyecto(${p.id})">Editar</button>
                            <button class="btn-secundario" style="padding: 5px 10px; font-size: 14px; margin-left: 5px;" onclick="verProyectoDashboard(${p.id})">Ver</button>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            proyectosContainer.innerHTML = `
                <h3>Mis Proyectos</h3>
                <div class="empty-state">
                    <h3>No tienes proyectos creados</h3>
                    <p>Crea tu primer proyecto para empezar a recibir inversiones</p>
                    <button class="boton-primario mt-4" onclick="mostrarFormularioProyecto()">Crear Primer Proyecto</button>
                </div>
            `;
        }
    }
}

// Funciones para dashboard emprendedor
function mostrarFormularioProyecto() {
    const form = document.getElementById('seccion-nuevo-proyecto');
    if (form) {
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth' });
    }
}

function ocultarFormularioProyecto() {
    const form = document.getElementById('seccion-nuevo-proyecto');
    if (form) {
        form.style.display = 'none';
    }
}

async function publicarProyecto() {
    const nombre = document.getElementById('nombre-p')?.value;
    const meta = document.getElementById('meta-p')?.value;
    const descripcion = document.getElementById('desc-p')?.value;
    const categoria = document.getElementById('categoria-p')?.value;
    const dias = document.getElementById('dias-p')?.value;
    
    if (!nombre || !meta || !descripcion) {
        showNotification('Por favor, completa todos los campos obligatorios.', 'warning');
        return;
    }
    
    if (parseFloat(meta) < 100) {
        showNotification('La meta mínima es $100.', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Debes iniciar sesión primero.', 'error');
        return;
    }
    
    // Calcular fecha límite
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias || 30));
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                titulo: nombre,
                descripcion: descripcion,
                meta_financiera: parseFloat(meta),
                fecha_limite: fechaLimite.toISOString().split('T')[0],
                categoria: categoria
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Proyecto creado exitosamente!', 'success');
            
            // Limpiar formulario
            document.getElementById('nombre-p').value = '';
            document.getElementById('meta-p').value = '';
            document.getElementById('desc-p').value = '';
            document.getElementById('categoria-p').value = 'tecnologia';
            document.getElementById('dias-p').value = '30';
            
            // Ocultar formulario
            ocultarFormularioProyecto();
            
            // Recargar dashboard
            cargarDashboardEmprendedor();
        } else {
            showNotification(`❌ ${data.error || 'Error al crear el proyecto'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error de conexión', 'error');
    } finally {
        ocultarLoader();
    }
}

function editarProyecto(id) {
    showNotification(`Editando proyecto #${id}...`, 'info');
    // Implementar edición
}

function verProyectoDashboard(id) {
    showNotification(`Viendo proyecto #${id}...`, 'info');
    // Implementar vista detallada
}

/* =========================================
   FUNCIONES PARA DASHBOARD INVERSOR
   ========================================= */

async function cargarDashboardInversor() {
    if (!verificarAutenticacion()) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/dashboard/inversor`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            actualizarDashboardInversor(data.data);
        } else {
            showNotification('❌ Error cargando dashboard', 'error');
            if (data.error === 'Acceso solo para inversores') {
                window.location.href = 'dashboard-emprendedor.html';
            }
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showNotification('❌ Error de conexión', 'error');
    } finally {
        ocultarLoader();
    }
}

function actualizarDashboardInversor(data) {
    // Actualizar nombre de usuario
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
        el.textContent = `Hola, ${data.usuario.nombre} 💰`;
    });
    
    // Actualizar estadísticas
    const statsContainer = document.querySelector('.perfil-inversionista');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>Total Invertido</h3>
                <p class="valor">$${data.estadisticas.total_invertido || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Apoyados</h3>
                <p class="valor">${data.estadisticas.total_inversiones || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Proyectos Diferentes</h3>
                <p class="valor">${data.estadisticas.proyectos_diferentes || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Saldo Disponible</h3>
                <p class="valor" style="color: #10B981;">$${data.usuario.saldo || 0}</p>
            </div>
        `;
    }
    
    // Actualizar lista de inversiones
    const inversionesContainer = document.querySelector('.lista-inversiones');
    if (inversionesContainer && data.inversiones) {
        if (data.inversiones.length > 0) {
            inversionesContainer.innerHTML = `
                <h3>Seguimiento de Inversiones</h3>
                ${data.inversiones.map(i => `
                    <div class="inversion-card">
                        <h4>${i.proyecto_titulo}</h4>
                        <p><strong>Emprendedor:</strong> ${i.emprendedor_nombre}</p>
                        <p><strong>Monto:</strong> $${i.monto}</p>
                        <p><strong>Fecha:</strong> ${new Date(i.fecha_inversion).toLocaleDateString('es-ES')}</p>
                        <p><strong>Estado Proyecto:</strong> <span style="color: ${
                            i.proyecto_estado === 'activo' ? '#10B981' : 
                            i.proyecto_estado === 'completado' ? '#3B82F6' : '#6B7280'
                        }">${i.proyecto_estado}</span></p>
                        <p><strong>Progreso:</strong> ${i.porcentaje_completado || 0}%</p>
                    </div>
                `).join('')}
            `;
        } else {
            inversionesContainer.innerHTML = `
                <h3>Seguimiento de Inversiones</h3>
                <div class="empty-state">
                    <h3>No tienes inversiones</h3>
                    <p>Explora proyectos y realiza tu primera inversión</p>
                    <a href="index.html" class="boton-primario mt-4">Explorar Proyectos</a>
                </div>
            `;
        }
    }
    
    // Actualizar proyectos recomendados
    const recomendadosContainer = document.getElementById('proyectos-recomendados-container');
    if (recomendadosContainer && data.proyectos_recomendados) {
        if (data.proyectos_recomendados.length > 0) {
            recomendadosContainer.innerHTML = data.proyectos_recomendados.map(p => crearTarjetaProyecto(p)).join('');
        } else {
            recomendadosContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No hay proyectos recomendados</h3>
                    <p>Explora todos los proyectos disponibles</p>
                </div>
            `;
        }
    }
}

// Recargar saldo
async function cargarSaldo() {
    const monto = prompt("Ingresa el monto a recargar (máximo $10,000):");
    
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
        showNotification('Por favor, ingresa un monto válido.', 'warning');
        return;
    }
    
    if (parseFloat(monto) > 10000) {
        showNotification('El monto máximo por recarga es $10,000.', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Debes iniciar sesión primero.', 'error');
        return;
    }
    
    mostrarLoader();
    
    try {
        const response = await fetch(`${API_URL}/auth/recharge`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ monto: parseFloat(monto) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`✅ Saldo recargado exitosamente! Nuevo saldo: $${data.nuevo_saldo}`, 'success');
            
            // Actualizar datos del usuario en localStorage
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.saldo = data.nuevo_saldo;
            localStorage.setItem('user', JSON.stringify(user));
            
            // Recargar dashboard
            cargarDashboardInversor();
        } else {
            showNotification(`❌ ${data.error || 'Error al recargar saldo'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error de conexión', 'error');
    } finally {
        ocultarLoader();
    }
}

/* =========================================
   FUNCIONES AUXILIARES
   ========================================= */

function mostrarLoader() {
    const loader = document.getElementById('loader-wrapper');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.animation = 'fadeIn 0.3s ease-out';
    }
}

function ocultarLoader() {
    const loader = document.getElementById('loader-wrapper');
    if (loader) {
        loader.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (loader) loader.style.display = 'none';
        }, 300);
    }
}

// Verificar conexión a internet
function verificarConexion() {
    if (!navigator.onLine) {
        showNotification('⚠️ Sin conexión a internet. Algunas funciones pueden no estar disponibles.', 'warning');
        return false;
    }
    return true;
}

// Cargar datos del usuario si está autenticado
async function cargarDatosUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Actualizar UI si está en dashboard
            const userNameElements = document.querySelectorAll('.user-name');
            userNameElements.forEach(el => {
                const emoji = data.user.tipo_usuario === 'emprendedor' ? '🚀' : '💰';
                el.textContent = `Hola, ${data.user.nombre} ${emoji}`;
            });
        }
    } catch (error) {
        console.error('Error cargando datos de usuario:', error);
    }
}

/* =========================================
   INICIALIZACIÓN
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando aplicación CrowdBoost...');
    
    // Verificar conexión
    verificarConexion();
    
    // Configurar eventos de conexión
    window.addEventListener('online', () => {
        showNotification('✅ Conexión restablecida', 'success');
    });
    
    window.addEventListener('offline', () => {
        showNotification('⚠️ Sin conexión a internet', 'warning');
    });
    
    // Verificar autenticación
    const estaAutenticado = verificarAutenticacion();
    
    // Cargar datos según la página
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'index.html' || currentPage === '' || currentPage.includes('index')) {
        // Página principal
        cargarEstadisticasGlobales();
        cargarProyectosDestacados();
        
        // Configurar búsqueda
        const inputBusqueda = document.getElementById('input-busqueda');
        if (inputBusqueda) {
            inputBusqueda.addEventListener('input', (e) => {
                buscarProyectos(e.target.value);
            });
            
            // Ocultar resultados al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    ocultarResultadosBusqueda();
                }
            });
        }
    } 
    else if (currentPage === 'dashboard-emprendedor.html') {
        // Dashboard emprendedor
        if (estaAutenticado) {
            cargarDashboardEmprendedor();
            cargarDatosUsuario();
            
            // Configurar botones
            const btnNuevoProyecto = document.querySelector('[onclick="mostrarFormularioProyecto()"]');
            if (btnNuevoProyecto) {
                btnNuevoProyecto.addEventListener('click', mostrarFormularioProyecto);
            }
            
            const btnPublicar = document.querySelector('[onclick="publicarProyecto()"]');
            if (btnPublicar) {
                btnPublicar.addEventListener('click', publicarProyecto);
            }
            
            const btnCancelar = document.querySelector('[onclick="ocultarFormularioProyecto()"]');
            if (btnCancelar) {
                btnCancelar.addEventListener('click', ocultarFormularioProyecto);
            }
        }
    } 
    else if (currentPage === 'dashboard-inversionista.html') {
        // Dashboard inversor
        if (estaAutenticado) {
            cargarDashboardInversor();
            cargarDatosUsuario();
            
            // Configurar botón de recargar saldo
            const btnRecargar = document.querySelector('[onclick="cargarSaldo()"]');
            if (btnRecargar) {
                btnRecargar.addEventListener('click', cargarSaldo);
            }
        }
    }
    
    // Configurar formularios de autenticación
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (form.querySelector('input[name="tipo_usuario"]')) {
                // Formulario de registro
                registrarUsuario(e);
            } else if (form.querySelector('input[type="email"]') && 
                       form.querySelector('input[type="password"]') &&
                       !form.querySelector('input[name="tipo_usuario"]')) {
                // Formulario de login
                iniciarSesion(e);
            }
        });
    });
    
    // Configurar botones de cerrar sesión
    const logoutButtons = document.querySelectorAll('[href*="index.html"], .boton-enlace[href="index.html"]');
    logoutButtons.forEach(btn => {
        if (btn.textContent.includes('Cerrar') || btn.textContent.includes('Salir') || 
            btn.closest('nav') && !btn.closest('footer')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                cerrarSesion();
            });
        }
    });
    
    // Verificar token periódicamente (cada 5 minutos)
    if (estaAutenticado) {
        setInterval(verificarToken, 5 * 60 * 1000);
    }
    
    // Ocultar loader después de 3 segundos máximo
    setTimeout(ocultarLoader, 3000);
    
    console.log('✅ Aplicación inicializada');
});

// Exportar funciones globales
window.registrarUsuario = registrarUsuario;
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
window.cargarSaldo = cargarSaldo;
window.mostrarFormularioProyecto = mostrarFormularioProyecto;
window.ocultarFormularioProyecto = ocultarFormularioProyecto;
window.publicarProyecto = publicarProyecto;
window.verDetalleProyecto = verDetalleProyecto;
window.showNotification = showNotification;