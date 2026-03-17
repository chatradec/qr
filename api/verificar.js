import { db } from "../lib/db.js";

export default async function handler(req,res){

const token = req.query.token;

const result = await db.execute({
sql:"SELECT * FROM ventas WHERE token=?",
args:[token]
});

if(result.rows.length===0){
res.json({ok:false});
return;
}

const venta = result.rows[0];

res.json({
ok:true,
cliente:venta.cliente,
producto:venta.producto,
usado:venta.usado===1
});

}