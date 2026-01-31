/* =========================================
   1. FUNCIONES GLOBALES (Loader y UI)
   ========================================= */
function mostrarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.remove("loader-hidden");
}

function ocultarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.add("loader-hidden");
}

/** * SEGURO DE VIDA DEL LOADER:
 * Si por algún error de código el loader no se oculta, 
 * esta función lo fuerza a cerrarse tras 5 segundos.
 */
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

// Respaldo por si el evento 'load' falla
setTimeout(ocultarLoader, 4000);

/* =========================================
   2. LÓGICA DE REDIRECCIÓN Y SESIÓN
   ========================================= */
function manejarRedireccion() {
    const rol = localStorage.getItem('userRol'); 

    setTimeout(() => {
        if (rol === 'emprendedor') {
            window.location.href = 'dashboard-emprendedor.html';
        } else if (rol === 'inversionista') {
            window.location.href = 'dashboard-inversionista.html';
        } else {
            window.location.href = 'index.html'; 
        }
    }, 2000); 
}

/* =========================================
   3. EVENTOS Y VALIDACIONES
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
    
    // Animación de estadísticas (si estamos en el index)
    if (document.getElementById('stat-users')) {
        animarNumeros();
    }

    const botonesCarga = document.querySelectorAll(".btn-cargar");
    
    botonesCarga.forEach(btn => {
        btn.addEventListener("click", function(e) {
            const formulario = this.closest('form');
            
            if (formulario) {
                if (!formulario.checkValidity()) return;

                const inputRol = formulario.querySelector('input[name="tipo_usuario"]:checked');
                
                if (inputRol) {
                    localStorage.setItem('userRol', inputRol.value);
                    localStorage.setItem('isLoggedIn', 'true');
                }
                
                e.preventDefault(); 
                mostrarLoader();
                manejarRedireccion();
            } else {
                mostrarLoader();
            }
        });
    });
});

/* Función para el botón del Dashboard Emprendedor */
function mostrarFormulario() {
    const form = document.getElementById('seccion-nuevo-proyecto');
    if(form) form.style.display = 'block';
}

/* =========================================
   4. GESTIÓN DE PROYECTOS (EMPRENDEDOR)
   ========================================= */

function publicarProyecto() {
    // 1. Capturamos los elementos para evitar errores de referencia
    const inputNombre = document.getElementById('nombre-p');
    const inputMeta = document.getElementById('meta-p');
    const inputDesc = document.getElementById('desc-p');

    if (!inputNombre || !inputMeta || !inputDesc) {
        console.error("❌ No se encontraron los campos del formulario en el HTML.");
        return;
    }

    // 2. VALIDACIÓN: Si falta algo, detenemos antes de mostrar el loader
    if (inputNombre.value.trim() === "" || inputMeta.value.trim() === "" || inputDesc.value.trim() === "") {
        alert("⚠️ Por favor, completa todos los campos del proyecto antes de publicar.");
        return; 
    }

    // 3. Activar el loader solo si la validación es exitosa
    mostrarLoader();

    // 4. Crear el objeto
    const nuevoProyecto = {
        id: Date.now(),
        nombre: inputNombre.value,
        meta: inputMeta.value,
        descripcion: inputDesc.value,
        recaudado: 0
    };

    // 5. Guardar en LocalStorage
    let proyectos = JSON.parse(localStorage.getItem('misProyectos')) || [];
    proyectos.push(nuevoProyecto);
    localStorage.setItem('misProyectos', JSON.stringify(proyectos));

    // 6. Simulamos el proceso de guardado
    setTimeout(() => {
        alert("✅ ¡Proyecto publicado con éxito!");
        document.getElementById('seccion-nuevo-proyecto').style.display = 'none';
        
        // Limpiamos campos
        inputNombre.value = "";
        inputMeta.value = "";
        inputDesc.value = "";
        
        ocultarLoader();
        
        if (typeof renderizarProyectos === 'function') renderizarProyectos();
    }, 1500);
}

/* =========================================
   5. SISTEMA DE BÚSQUEDA DINÁMICA
   ========================================= */
const baseDeDatosProyectos = [
    { nombre: "Dron de Rescate Solar", categoria: "Tecnología" },
    { nombre: "Huertos Verticales Urbanos", categoria: "Ecología" },
    { nombre: "App de Salud Mental", categoria: "Salud" },
    { nombre: "Limpieza de Océanos Pro", categoria: "Ecología" },
    { nombre: "Realidad Aumentada Educativa", categoria: "Tecnología" }
];

document.addEventListener("DOMContentLoaded", () => {
    const inputBusqueda = document.getElementById('input-busqueda');
    const contenedorResultados = document.getElementById('resultados-busqueda');

    if (inputBusqueda && contenedorResultados) {
        inputBusqueda.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase();
            contenedorResultados.innerHTML = '';

            if (texto.length > 0) {
                const coincidencias = baseDeDatosProyectos.filter(p => 
                    p.nombre.toLowerCase().includes(texto) || 
                    p.categoria.toLowerCase().includes(texto)
                );

                if (coincidencias.length > 0) {
                    contenedorResultados.style.display = 'block';
                    coincidencias.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'resultado-item';
                        div.innerHTML = `
                            <span class="categoria">${p.categoria}</span>
                            <span>${p.nombre}</span>
                        `;
                        div.onclick = () => {
                            inputBusqueda.value = p.nombre;
                            contenedorResultados.style.display = 'none';
                        };
                        contenedorResultados.appendChild(div);
                    });
                } else {
                    contenedorResultados.style.display = 'none';
                }
            } else {
                contenedorResultados.style.display = 'none';
            }
        });
    }
});

/* =========================================
   6. ANIMACIÓN DE ESTADÍSTICAS (INDEX)
   ========================================= */
function animarNumeros() {
    const stats = [
        { id: 'stat-users', final: 15000, sufijo: '+' },
        { id: 'stat-funded', final: 450, sufijo: '' },
        { id: 'stat-money', final: 2.5, sufijo: 'M' }
    ];

    stats.forEach(s => {
        const el = document.getElementById(s.id);
        if (!el) return;
        
        let inicio = 0;
        let incremento = s.final / 50;
        
        const intervalo = setInterval(() => {
            inicio += incremento;
            if (inicio >= s.final) {
                el.innerText = s.final + s.sufijo;
                clearInterval(intervalo);
            } else {
                el.innerText = Math.floor(inicio) + s.sufijo;
            }
        }, 30);
    });
}