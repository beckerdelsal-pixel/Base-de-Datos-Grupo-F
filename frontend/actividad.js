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

//PARA EL INVERSIONISTA CARGAR DINERO A SU CUENTA
async function cargarSaldo() {
    const monto = prompt("Ingrese el monto a cargar:");
    const userId = localStorage.getItem('userId');

    if (!monto || isNaN(monto)) return alert("Monto inválido");

    try {
        const response = await fetch(`${API_URL}/usuarios/saldo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, monto })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`Saldo actualizado: $${data.nuevoSaldo}`);
            location.reload(); // Recargar para ver el cambio
        }
    } catch (err) {
        alert("Error al conectar con el servidor");
    }
}

// Realizar inversión
async function invertir(proyectoId) {
    const monto = prompt("¿Cuánto deseas invertir en este proyecto?");
    const userId = localStorage.getItem('userId');

    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) return;

    try {
        const response = await fetch(`${API_URL}/proyectos/invertir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                proyectoId,
                monto: parseFloat(monto)
            })
        });

        const data = await response.json();

        if (response.ok) {
            // 1. Alert básico de éxito
            alert("¡Inversión realizada con éxito! 🎉");

            // 2. VERIFICACIÓN DE META CUMPLIDA
            // Obtenemos los datos actualizados del proyecto para verificar la meta
            const resProyecto = await fetch(`${API_URL}/proyectos`);
            const proyectos = await resProyecto.json();
            const proyectoActualizado = proyectos.find(p => p.id === proyectoId);

            if (proyectoActualizado && proyectoActualizado.actual >= proyectoActualizado.meta) {
                alert(`¡HISTÓRICO! 🚀 El proyecto "${proyectoActualizado.nombre}" ha alcanzado el 100% de su meta gracias a tu aporte. ¡Felicidades!`);
            }

            location.reload(); // Recargar para actualizar saldos y tablas
        } else {
            alert("Error: " + data.error);
        }
    } catch (err) {
        console.error("Error en la inversión:", err);
        alert("Error de conexión al realizar la inversión.");
    }
}

// Obtener y mostrar el saldo actual del usuario
async function actualizarVistaSaldo() {
    const userId = localStorage.getItem('userId');
    const saldoElement = document.getElementById('display-saldo');

    if (!userId || !saldoElement) return;

    try {
        // Creamos una ruta simple para obtener datos del usuario
        const response = await fetch(`${API_URL}/usuarios/${userId}`);
        const data = await response.json();

        if (response.ok) {
            // Formateamos el número a moneda (ej: $1,250.00)
            saldoElement.textContent = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(data.saldo || 0);
        }
    } catch (err) {
        console.error("Error al obtener saldo:", err);
    }
}

// Carga las estadísticas rápidas (Cards superiores)
async function cargarEstadisticas() {
    const userId = localStorage.getItem('userId');
    const contenedor = document.getElementById('contenedor-estadisticas');
    if (!contenedor) return;

    try {
        // En una app real, haríamos un fetch a un endpoint de stats
        // Por ahora, simularemos los datos basados en el saldo y la info del usuario
        const response = await fetch(`${API_URL}/usuarios/${userId}`);
        const user = await response.json();

        contenedor.innerHTML = `
            <div class="card-stat">
                <h4>Total Invertido</h4>
                <p class="monto-stat">$0.00</p>
            </div>
            <div class="card-stat">
                <h4>Proyectos Apoyados</h4>
                <p class="monto-stat">0</p>
            </div>
            <div class="card-stat">
                <h4>Saldo en Cuenta</h4>
                <p class="monto-stat">$${user.saldo || '0.00'}</p>
            </div>
        `;
    } catch (err) {
        console.error("Error en stats:", err);
    }
}



// Carga la lista de inversiones realizadas por este usuario
async function cargarMisInversiones() {
    const userId = localStorage.getItem('userId');
    const contenedor = document.getElementById('contenedor-mis-inversiones');
    if (!contenedor || !userId) return;

    try {
        const response = await fetch(`${API_URL}/usuarios/${userId}/inversiones`);
        const inversiones = await response.json();

        if (inversiones.length === 0) {
            contenedor.innerHTML = '<p>Aún no has realizado ninguna inversión.</p>';
            return;
        }

        let html = '<table class="tabla-inversiones"><thead><tr><th>Proyecto</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>';

        inversiones.forEach(inv => {
            const fecha = new Date(inv.fecha_inversion).toLocaleDateString();
            html += `
                <tr>
                    <td><strong>${inv.proyecto_nombre}</strong></td>
                    <td>$${inv.monto}</td>
                    <td>${fecha}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar historial:", err);
    }
}

// --- 3. FUNCIONES DE PROYECTOS ---

// Enviar nuevo proyecto a la DB
async function crearProyecto(e) {
    if (e) e.preventDefault();

    const userId = localStorage.getItem('userId');
    
    // Validación de seguridad: Si no hay ID, no permitimos el envío
    if (!userId) {
        alert("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        window.location.href = 'login.html';
        return;
    }

    const proyecto = {
        nombre: document.getElementById('proj-nombre').value,
        descripcion: document.getElementById('proj-descripcion').value,
        meta: parseFloat(document.getElementById('proj-meta').value),
        categoria: document.getElementById('proj-categoria').value,
        emprendedor_id: userId // Ahora usamos el ID real obligatoriamente
    };

    try {
        const response = await fetch(`${API_URL}/proyectos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proyecto)
        });

        if (response.ok) {
            alert('¡Proyecto publicado con éxito! 🎉');
            // En lugar de redireccionar, podemos simplemente ocultar el formulario 
            // y recargar la lista para que la experiencia sea más fluida
            ocultarFormularioProyecto(); 
            cargarProyectos(); 
            document.getElementById('form-crear-proyecto').reset(); // Limpia los campos
        } else {
            const data = await response.json();
            alert('Error: ' + (data.error || 'No se pudo guardar el proyecto.'));
        }
    } catch (err) { 
        console.error(err);
        alert('Error al conectar con el servidor'); 
    }
}

// Cargar y mostrar proyectos en el Dashboard
// MEJORA EN CARGAR PROYECTOS (Vista Inversionista vs Emprendedor)
async function cargarProyectos() {
    const contenedorInv = document.getElementById('proyectos-recomendados-container');
    const contenedorEmp = document.getElementById('contenedor-proyectos');
    const contenedor = contenedorInv || contenedorEmp;
    if (!contenedor) return;

    const userId = localStorage.getItem('userId');
    const esInversionista = window.location.href.includes('dashboard-inversionista');
    
    // Si es emprendedor, usamos la nueva ruta filtrada; si no, la general
    const urlBusqueda = (!esInversionista && userId) 
        ? `${API_URL}/proyectos/usuario/${userId}` 
        : `${API_URL}/proyectos`;

    try {
        const response = await fetch(urlBusqueda);
        const proyectos = await response.json();

        contenedor.innerHTML = '';

        if (proyectos.length === 0) {
            contenedor.innerHTML = `<p style="text-align:center; padding:20px; color:#666;">
                ${esInversionista ? 'No hay proyectos disponibles.' : 'Aún no has creado proyectos.'}
            </p>`;
            return;
        }

        proyectos.forEach(p => {
            const porcentaje = Math.min((p.actual / p.meta) * 100, 100).toFixed(1);

            contenedor.innerHTML += `
                <div class="tarjeta-proyecto-dash">
                    <div class="proyecto-info">
                        <span class="tag-categoria">${p.categoria || 'Innovación'}</span>
                        <h4>${p.nombre}</h4>
                        <p>${p.descripcion.substring(0, 100)}...</p>
                    </div>
                    <div class="proyecto-stats">
                        <div class="barra-progreso-bg">
                            <div class="barra-progreso-fill" style="width: ${porcentaje}%"></div>
                        </div>
                        <div class="stats-numeros">
                            <span><strong>${porcentaje}%</strong> financiado</span>
                            <span>Meta: $${p.meta}</span>
                        </div>
                    </div>
                    ${esInversionista ? 
                        `<button onclick="invertir(${p.id})" class="boton-invertir-mini">💰 Invertir</button>` : 
                        `<div class="tag-rol-propio">Recaudado: $${p.actual}</div>`
                    }
                </div>`;
        });
    } catch (err) {
        console.error("Error cargando proyectos:", err);
    }
}

// --- 4. INICIALIZADOR DE EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Manejo del Login
    const formLogin = document.getElementById('login-form');
    if (formLogin) formLogin.addEventListener('submit', iniciarSesion);

    // 1.5 Manejo del Registro (ESTO ES LO QUE FALTA)
    const formRegistro = document.getElementById('registro-form');
    if (formRegistro) {
        formRegistro.addEventListener('submit', registrarUsuario);
        console.log("Escuchador de registro activado correctamente ✅");
    }

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
    }, 3000); //3s para no esperar tanto

    if (document.getElementById('display-saldo')) {
        actualizarVistaSaldo();
    }
    if (document.getElementById('proyectos-recomendados-container')) {
        cargarProyectos();
    }
    if (document.getElementById('contenedor-estadisticas')) {
        cargarEstadisticas();
        cargarMisInversiones();
    }
    if (document.getElementById('contenedor-proyectos')) {
        cargarProyectos();
    }
});