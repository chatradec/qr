import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './lib/db.js';

import nuevaVentaRouter from './api/nueva-venta.js';
import verificarVentaRouter from './api/verificar-venta.js';
import consultaVentaRouter from './api/consulta-venta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ⚠️ Los HTML están en la RAÍZ, no en /public
app.use(express.static(__dirname));

// Inicializar DB (crea la tabla si no existe)
initDB();

// Rutas API
app.use('/api/nueva-venta', nuevaVentaRouter);
app.use('/api/verificar-venta', verificarVentaRouter);
app.use('/api/venta', consultaVentaRouter);

// Rutas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});

export default app;