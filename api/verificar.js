import express from 'express';
import { buscarVenta, marcarUsado } from '../lib/db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    const venta = await buscarVenta(token);

    if (!venta) {
      return res.status(404).json({ 
        success: false, 
        valido: false, 
        mensaje: 'Token no encontrado' 
      });
    }

    if (venta.estado === 'usado') {
      return res.status(400).json({ 
        success: true, 
        valido: false, 
        mensaje: '⚠️ Este QR ya fue usado',
        venta: {
          cliente: venta.cliente,
          empresa: venta.empresa,
          producto: venta.producto,
          creado_en: venta.creado_en,
          verificado_en: venta.verificado_en
        }
      });
    }

    const verificadoEn = new Date().toISOString();
    await marcarUsado(token, verificadoEn);

    res.json({ 
      success: true, 
      valido: true, 
      mensaje: '✅ QR válido - Venta verificada',
      venta: {
        cliente: venta.cliente,
        empresa: venta.empresa,
        producto: venta.producto,
        creado_en: venta.creado_en,
        verificado_en: verificadoEn
      }
    });

  } catch (error) {
    console.error('❌ Error en verificar-venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;