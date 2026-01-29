function mostrarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.remove("loader-hidden");
}

function ocultarLoader() {
    const loader = document.getElementById("loader-wrapper");
    if (loader) loader.classList.add("loader-hidden");
}

// Ocultar cuando la página carga
window.addEventListener("load", () => {
    setTimeout(ocultarLoader, 600); // Pequeño retraso para suavidad
});

// Forzar ocultado si tarda demasiado (seguro de vida)
setTimeout(ocultarLoader, 3000);

// Activar loader en botones con clase .btn-cargar
document.addEventListener("DOMContentLoaded", () => {
    const botones = document.querySelectorAll(".btn-cargar");
    botones.forEach(btn => {
        btn.addEventListener("click", () => {
            mostrarLoader();
        });
    });
});