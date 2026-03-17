import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

export async function initDB() {
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
  console.log('✅ Tabla "ventas" creada/verificada');
}

export async function crearVenta(token, cliente, empresa, producto) {
  await turso.execute({
    sql: 'INSERT INTO ventas (token, cliente, empresa, producto) VALUES (?, ?, ?, ?)',
    args: [token, cliente, empresa, producto]
  });
}

export async function buscarVenta(token) {
  const result = await turso.execute({
    sql: 'SELECT * FROM ventas WHERE token = ?',
    args: [token]
  });
  return result.rows[0];
}

export async function marcarUsado(token, verificadoEn) {
  await turso.execute({
    sql: 'UPDATE ventas SET estado = ?, verificado_en = ? WHERE token = ?',
    args: ['usado', verificadoEn, token]
  });
}

export default turso;