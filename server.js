import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar variables de entorno
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let turso;
if (TURSO_URL && TURSO_TOKEN) {
  try {
    turso = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN
    });
  } catch (err) {
    console.error('Error Turso:', err.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar DB
async function initDB() {
  if (!turso) return;
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
    console.error('Error initDB:', err.message);
  }
}

// API: Test
app.get('/api/test', (req, res) => {
  res.json({ 
    ok: true, 
    dbConfigured: !!turso,
    timestamp: new Date().toISOString()
  });
});

// API: Crear venta
app.post('/api/nueva-venta', async (req, res) => {
  try {
    await initDB();
    
    if (!turso) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { cliente, empresa, producto } = req.body;
    if (!cliente || !empresa || !producto) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const host = req.headers.host || 'qr-seven-tau.vercel.app';
    const url = `https://${host}/scanner.html?token=${token}`;

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

// API: Verificar venta
app.post('/api/verificar-venta', async (req, res) => {
  try {
    await initDB();
    
    if (!turso) {
      return res.status(500).json({ error: 'Database not configured' });
    }

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

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'panel.html'));
});

export default app;