import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ VERIFICAR VARIABLES DE ENTORNO
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('❌ FALTAN VARIABLES DE ENTORNO: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN');
}

// 🗄️ Conexión a Turso (con try-catch)
let turso;
try {
  turso = createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || ''
  });
} catch (err) {
  console.error('❌ Error conectando a Turso:', err.message);
}

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 🗄️ Inicializar tabla
async function initDB() {
  if (!turso) {
    throw new Error('Database not initialized');
  }
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
    throw err;
  }
}

// Middleware para loguear requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 🌐 RUTA: Crear venta
app.post('/api/nueva-venta', async (req, res) => {
  try {
    await initDB();
    const { cliente, empresa, producto } = req.body;
    
    if (!cliente || !empresa || !producto) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const host = req.headers.host || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const url = `${protocol}://${host}/verificar.html?token=${token}`;

    await turso.execute({
      sql: 'INSERT INTO ventas (token, cliente, empresa, producto) VALUES (?, ?, ?, ?)',
      args: [token, cliente, empresa, producto]
    });

    res.status(201).json({ success: true, token, url });
  } catch (err) {
    console.error('❌ Error nueva-venta:', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// 🔍 RUTA: Verificar venta
app.post('/api/verificar-venta', async (req, res) => {
  try {
    await initDB();
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    const result = await turso.execute({
      sql: 'SELECT * FROM ventas WHERE token = ?',
      args: [token]
    });

    const venta = result.rows[0];
    
    if (!venta) {
      return res.status(404).json({ 
        success: false, 
        valido: false, 
        mensaje: 'Código QR no válido' 
      });
    }

    if (venta.estado === 'usado') {
      return res.json({ 
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
    console.error('❌ Error verificar-venta:', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// 🔎 RUTA: Consultar venta
app.get('/api/venta/:token', async (req, res) => {
  try {
    await initDB();
    const { token } = req.params;
    
    const result = await turso.execute({
      sql: 'SELECT * FROM ventas WHERE token = ?',
      args: [token]
    });

    const venta = result.rows[0];
    
    if (!venta) {
      return res.status(404).json({ error: 'No encontrada' });
    }

    res.json({ success: true, venta });
  } catch (err) {
    console.error('❌ Error consulta-venta:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📄 SERVIR ARCHIVOS ESTÁTICOS
app.use(express.static(__dirname));

// 🏠 Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'panel.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('💥 Error global:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;