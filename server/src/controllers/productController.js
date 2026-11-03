import { createProduct, deactivateProduct, listProducts } from "../services/productService.js";
import { importProductFile, listImports } from "../services/productImportService.js";
import { archiveUpload, syncFromErp, transferSettings } from "../services/erpTransferService.js";
import { sendError } from "../utils/errors.js";
import { cleanText } from "../validators/common.js";

export async function getProducts(req,res,next){try{res.json({products:await listProducts()});}catch(e){next(e);}}
export async function addProduct(req,res,next){try{res.status(201).json({product:await createProduct(req.body)});}catch(e){sendError(res,next,400,e);}}
export async function removeProduct(req,res,next){try{await deactivateProduct(req.params.id);res.json({message:"Product removed."});}catch(e){sendError(res,next,404,e);}}

// Manual upload from the admin dashboard: {fileName, content, fullSync}. The earlier body {products: [...]} still works.
export async function uploadProductFile(req, res, next) {
  try {
    const body = req.body || {};
    const legacy = body.content === undefined && Array.isArray(body.products);
    const fileName = legacy ? "upload.json" : cleanText(body.fileName, 200) || "upload.csv";
    const content = legacy ? JSON.stringify(body) : body.content;
    if (typeof content !== "string") return res.status(400).json({error: "Send the file as {fileName, content}."});
    const report = await importProductFile({fileName, content, source: "upload", fullSync: body.fullSync === true});
    await archiveUpload(fileName, content, report);
    if (report.status === "failed") return res.status(422).json({error: `${fileName} was not imported (${report.errors.length} problem(s)).`, report});
    res.json({report});
  } catch (error) {
    next(error);
  }
}

// On-demand transfer: export from the ERP into the inbox and import it right away.
export async function syncErpProducts(req,res,next){try{res.json(await syncFromErp());}catch(e){next(e);}}
export async function getImports(req,res,next){try{res.json({imports:await listImports(),transfer:transferSettings()});}catch(e){next(e);}}
