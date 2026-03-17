import crypto from "crypto";
import { db } from "../lib/db.js";

export default async function handler(req, res) {

try {

if(req.method !== "POST"){
return res.status(405).json({error:"Metodo no permitido"});
}

const { cliente, empresa, producto } = req.body;

const token = crypto.randomBytes(16).toString("hex");

await db.execute({
sql: "INSERT INTO ventas(token,cliente,empresa,producto) VALUES(?,?,?,?)",
args: [token, cliente, empresa, producto],
});

return res.status(200).json({
ok: true,
token,
url: `${req.headers.origin}/verificar.html?token=${token}`,
});

} catch (e) {

console.error("ERROR REAL:", e);

return res.status(500).json({
error: e.message
});

}

}
