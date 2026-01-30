function mostrarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.remove("loader-hidden");
}

function ocultarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.add("loader-hidden");
}

// Ocultar al cargar y seguro de vida
window.addEventListener("load", () => setTimeout(ocultarLoader, 500));
setTimeout(ocultarLoader, 4000);

/* =========================================
   2. SIMULACIÓN DE SESIÓN Y DASHBOARD
   ========================================= */
// Cambia el rol a 'emprendedor' para ver la otra interfaz
const usuarioLogueado = {
    nombre: "Alex",
    rol: "inversionista" 
};

function cargarDashboard() {
    const contenedor = document.getElementById("dashboard-dinamico");
    if (!contenedor) return;

    if (usuarioLogueado.rol === "inversionista") {
        contenedor.className = "dashboard-grid perfil-inversionista";
        contenedor.innerHTML = `
            <div class="stat-card">
                <h3>💰 Mi Capital Invertido</h3>
                <p class="valor">$12,450.00</p>
                <button class="boton-invertir" onclick="alert('Abriendo historial...')">Ver Detalle</button>
            </div>
            <div class="stat-card">
                <h3>📂 Proyectos Apoyados</h3>
                <p class="valor">8</p>
                <p>3 con actualizaciones hoy.</p>
            </div>
            <div class="stat-card">
                <h3>📈 Rendimiento</h3>
                <p class="valor">+12.5%</p>
            </div>
        `;
    } else {
        contenedor.className = "dashboard-grid perfil-emprendedor";
        contenedor.innerHTML = `
            <div class="stat-card">
                <h3>🚀 Mi Recaudación</h3>
                <p class="valor">$45,000 / $60,000</p>
                <div class="progreso-contenedor"><div class="progreso-barra" style="width: 75%;"></div></div>
            </div>
            <div class="stat-card">
                <h3>👥 Inversionistas</h3>
                <p class="valor">24</p>
                <button class="boton-primario">Notificar Avance</button>
            </div>
            <div class="stat-card">
                <h3>⏳ Tiempo Restante</h3>
                <p class="valor">14 Días</p>
            </div>
        `;
    }
}

/* =========================================
   3. EVENTOS Y VALIDACIONES (DOMContentLoaded)
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
    
    // Ejecutar carga de dashboard si existe el contenedor
    cargarDashboard();

    // Manejo de botones con carga y validación
    const botonesCarga = document.querySelectorAll(".btn-cargar");
    botonesCarga.forEach(btn => {
        btn.addEventListener("click", function(e) {
            const formulario = this.closest('form');
            if (formulario) {
                if (!formulario.checkValidity()) return;
            }
            mostrarLoader();
        });
    });
});