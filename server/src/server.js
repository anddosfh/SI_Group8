import express from "express";
import cors from "cors";
import { DATABASE_URL, PORT } from "./config/env.js";
import { initDatabase } from "./database/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const app=express();
app.use(cors({origin:["http://localhost:5173","http://127.0.0.1:5173"]}));
app.use(express.json({limit:"1mb"}));
app.get("/api/health",(req,res)=>res.json({status:"ok",service:"NOVA Gadgets API",time:new Date().toISOString()}));
app.use("/api/auth",authRoutes);
app.use("/api/products",productRoutes);
app.use("/api/orders",orderRoutes);
app.use((req,res)=>res.status(404).json({error:"Endpoint not found."}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Unexpected server error."});});

initDatabase().then(()=>{
  // Host and database name only (never the password), so everyone can see whether they are on the shared database.
  const {hostname,pathname}=new URL(DATABASE_URL);
  app.listen(PORT,()=>console.log(`NOVA Gadgets API running at http://localhost:${PORT} (database: ${hostname}${pathname})`));
}).catch(error=>{console.error("Could not initialise the PostgreSQL database (check DATABASE_URL in server/.env):",error);process.exit(1);});
