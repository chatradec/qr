import express from 'express';
import crypto from 'crypto';
import { crearVenta } from '../lib/db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { cliente, empresa, producto } = req.body;

    if (!cliente || !empresa || !producto) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = `${frontendUrl}/verificar.html?token=${token}`;

    await crearVenta(token, cliente, empresa, producto);

    res.status(201).json({ success: true, token, url });

  } catch (error) {
    console.error('❌ Error en nueva-venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;