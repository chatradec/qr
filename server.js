import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🗄️ Conexión a Turso
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// 📦 Express
const app = express();
app.use(cors());
app.use(express.json());

// 🗄️ Inicializar tabla
async function initDB() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        cliente TEXT NOT NULL,
        empresa TEXT NOT NULL,
        producto TEXT NOT NULL,
        creado_en TEXT DEFAULT (datetime('now')),
        estado TEXT DEFAULT 'pendiente',
        verificado_en TEXT
      )
    `);
  } catch (err) {
    console.error('❌ Error initDB:', err.message);
  }
}

// 🌐 RUTA: Crear venta
app.post('/api/nueva-venta', async (req, res) => {
  await initDB();
  try {
    const { cliente, empresa, producto } = req.body;
    if (!cliente || !empresa || !producto) {
      return res.status(400).json({ error: 'Faltan campos' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    const url = `${process.env.FRONTEND_URL || 'https://' + req.headers.host}/verificar.html?token=${token}`;
    
    await turso.execute({
      sql: 'INSERT INTO ventas (token, cliente, empresa, producto) VALUES (?, ?, ?, ?)',
      args: [token, cliente, empresa, producto]
    });
    
    res.status(201).json({ success: true, token, url });
  } catch (err) {
    console.error('❌ Error nueva-venta:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

// 🔍 RUTA: Verificar venta (USO ÚNICO)
app.post('/api/verificar-venta', async (req, res) => {
  await initDB();
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    
    const result = await turso.execute({
      sql: 'SELECT * FROM ventas WHERE token = ?',
      args: [token]
    });
    
    const venta = result.rows[0];
    if (!venta) return res.status(404).json({ success: false, valido: false, mensaje: 'Código QR no válido' });
    
    if (venta.estado === 'usado') {
      return res.status(400).json({ 
        success: true, 
        valido: false, 
        mensaje: '⚠️ Este código QR ya fue utilizado',
        venta: { 
          cliente: venta.cliente, 
          empresa: venta.empresa, 
          producto: venta.producto,
          verificado_en: venta.verificado_en 
        }
      });
    }
    
    // ✅ Marcar como usado (USO ÚNICO)
    const verificadoEn = new Date().toISOString();
    await turso.execute({
      sql: 'UPDATE ventas SET estado = ?, verificado_en = ? WHERE token = ?',
      args: ['usado', verificadoEn, token]
    });
    
    res.json({ 
      success: true, 
      valido: true, 
      mensaje: '✅ Código QR verificado correctamente',
      venta: { 
        cliente: venta.cliente, 
        empresa: venta.empresa, 
        producto: venta.producto, 
        verificado_en: verificadoEn 
      }
    });
  } catch (err) {
    console.error('❌ Error verificar-venta:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// 🔎 RUTA: Consultar venta (para debug)
app.get('/api/venta/:token', async (req, res) => {
  await initDB();
  try {
    const { token } = req.params;
    const result = await turso.execute({
      sql: 'SELECT * FROM ventas WHERE token = ?',
      args: [token]
    });
    const venta = result.rows[0];
    if (!venta) return res.status(404).json({ error: 'No encontrada' });
    res.json({ success: true, venta });
  } catch (err) {
    console.error('❌ Error consulta-venta:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// 📄 SERVIR ARCHIVOS ESTÁTICOS (IMPORTANTE)
app.use(express.static(__dirname));

// 🏠 Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'panel.html'));
});

// ✅ Exportar para Vercel
export default app;