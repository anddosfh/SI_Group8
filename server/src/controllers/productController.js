import { createProduct, deactivateProduct, listProducts } from "../services/productService.js";
import { sendError } from "../utils/errors.js";
import { importProducts } from "../services/productImportService.js";

export async function getProducts(req,res,next){try{res.json({products:await listProducts()});}catch(e){next(e);}}
export async function addProduct(req,res,next){try{res.status(201).json({product:await createProduct(req.body)});}catch(e){sendError(res,next,400,e);}}
export async function removeProduct(req,res,next){try{await deactivateProduct(req.params.id);res.json({message:"Product removed."});}catch(e){sendError(res,next,404,e);}}

export async function importProductFile(req, res, next) {
  try {
    const result = await importProducts(req.body);

    res.json({
      message: "ERP product import completed successfully.",
      ...result
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        error: "The uploaded file contains invalid JSON."
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    next(error);
  }
}