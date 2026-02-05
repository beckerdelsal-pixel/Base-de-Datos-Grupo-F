const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM proyectos) as total_proyectos,
                (SELECT COALESCE(SUM(fondos_recaudados), 0) FROM proyectos) as dinero_total,
                (SELECT COUNT(*) FROM usuarios WHERE tipo_usuario = 'inversor') as total_inversores
        `;
        const popularQuery = `
            SELECT * FROM proyectos 
            ORDER BY fondos_recaudados DESC 
            LIMIT 3
        `;
        
        const stats = await query(statsQuery);
        const populares = await query(popularQuery);

        res.json({
            success: true,
            stats: stats.rows[0],
            populares: populares.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;