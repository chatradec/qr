import express from 'express';
import { buscarVenta } from '../lib/db.js';

const router = express.Router();

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const venta = await buscarVenta(token);

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    res.json({
      success: true,
      venta: {
        token: venta.token,
        cliente: venta.cliente,
        empresa: venta.empresa,
        producto: venta.producto,
        estado: venta.estado,
        creado_en: venta.creado_en,
        verificado_en: venta.verificado_en
      }
    });

  } catch (error) {
    console.error('❌ Error en consulta-venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;