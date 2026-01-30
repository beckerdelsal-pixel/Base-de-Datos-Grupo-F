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

// Ocultar al cargar y seguro de vida de 4s
window.addEventListener("load", () => setTimeout(ocultarLoader, 500));
setTimeout(ocultarLoader, 4000);

/* =========================================
   2. LÓGICA DE REDIRECCIÓN Y SESIÓN
   ========================================= */
function manejarRedireccion() {
    // Leemos el rol guardado en localStorage
    const rol = localStorage.getItem('userRol'); 

    // Simulamos tiempo de carga para mostrar el loader
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
    
    const botonesCarga = document.querySelectorAll(".btn-cargar");
    
    botonesCarga.forEach(btn => {
        btn.addEventListener("click", function(e) {
            const formulario = this.closest('form');
            
            if (formulario) {
                // Si el formulario no es válido (nativa HTML5), no hace nada
                if (!formulario.checkValidity()) return;

                // --- CAPTURA DE ROL (Basado en tu HTML) ---
                // Buscamos el input con name="tipo_usuario" que esté marcado
                const inputRol = formulario.querySelector('input[name="tipo_usuario"]:checked');
                
                if (inputRol) {
                    // Guardamos 'inversionista' o 'emprendedor'
                    localStorage.setItem('userRol', inputRol.value);
                    localStorage.setItem('isLoggedIn', 'true');
                }
                
                // Evitamos el envío real para que se vea la animación
                e.preventDefault(); 
                
                mostrarLoader();
                manejarRedireccion();
            } else {
                // Si es un enlace normal con la clase btn-cargar
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