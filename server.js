import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Conexión a Turso
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar DB
async function initDB() {
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
}

// 🌐 API: Crear venta (desde panel.html)
app.post('/api/nueva-venta', async (req, res) => {
  try {
    await initDB();
    const { cliente, empresa, producto } = req.body;
    
    if (!cliente || !empresa || !producto) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const url = `https://qr-seven-tau.vercel.app/scanner.html?token=${token}`;

    await turso.execute({
      sql: 'INSERT INTO ventas (token, cliente, empresa, producto) VALUES (?, ?, ?, ?)',
      args: [token, cliente, empresa, producto]
    });

    res.status(201).json({ success: true, token, url });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔍 API: Verificar/canjear venta (desde scanner.html)
app.post('/api/verificar-venta', async (req, res) => {
  try {
    await initDB();
    const { token } = req.body;
    
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const result = await turso.execute({
      sql: 'SELECT * FROM ventas WHERE token = ?',
      args: [token]
    });

    const venta = result.rows[0];
    
    if (!venta) {
      return res.status(404).json({ 
        success: false, 
        valido: false, 
        mensaje: 'No encontrado' 
      });
    }

    if (venta.estado === 'usado') {
      return res.json({ 
        success: true, 
        valido: false, 
        mensaje: 'Ya fue usado',
        venta: {
          cliente: venta.cliente,
          empresa: venta.empresa,
          producto: venta.producto,
          verificado_en: venta.verificado_en
        }
      });
    }

    // ✅ Canjear (marcar como usado)
    const verificadoEn = new Date().toISOString();
    await turso.execute({
      sql: 'UPDATE ventas SET estado = ?, verificado_en = ? WHERE token = ?',
      args: ['usado', verificadoEn, token]
    });

    res.json({
      success: true,
      valido: true,
      mensaje: 'Verificado correctamente',
      venta: {
        cliente: venta.cliente,
        empresa: venta.empresa,
        producto: venta.producto,
        verificado_en: verificadoEn
      }
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📄 Servir archivos estáticos
app.use(express.static(__dirname));

// Redirección raíz a panel
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'panel.html'));
});

export default app;