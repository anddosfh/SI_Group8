import { createProduct, deactivateProduct, listProducts } from "../services/productService.js";
import { sendError } from "../utils/errors.js";
export async function getProducts(req,res,next){try{res.json({products:await listProducts()});}catch(e){next(e);}}
export async function addProduct(req,res,next){try{res.status(201).json({product:await createProduct(req.body)});}catch(e){sendError(res,next,400,e);}}
export async function removeProduct(req,res,next){try{await deactivateProduct(req.params.id);res.json({message:"Product removed."});}catch(e){sendError(res,next,404,e);}}
