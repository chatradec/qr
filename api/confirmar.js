import { db } from "../lib/db.js";

export default async function handler(req,res){

const {token} = req.body;

await db.execute({
sql:"UPDATE ventas SET usado=1 WHERE token=?",
args:[token]
});

res.json({ok:true});

}