# Mini-ERP test data for NOVA Gadgets

`test-data/de.fhaachen.simpleerp-Products.csv` replaces the file of the same name in the Mini-ERP
(`systems-integration/src/simple-erp/test/data/`). It keeps the ERP's two sample bikes (`DXTR1000`, `GRVL1000`;
the ERP's own tests expect them) and adds the 16 NOVA products. Their `productID` (e.g. `NOVA-PHONE-ONE`) is the
`erp_product_id` of the shop's demo products, so an ERP import updates them instead of creating duplicates.

The Mini-ERP keeps its data in memory: everything changed in its UI is lost when `cds watch` restarts, and the
products of this file are loaded again.

## Install (every group member, once)

```powershell
Copy-Item .\erp\test-data\de.fhaachen.simpleerp-Products.csv "$HOME\systems-integration\src\simple-erp\test\data\" -Force
```

Adjust the path to where you cloned `systems-integration`. A running `cds watch` reloads automatically.

## Check

Open `http://localhost:4004/rest/api/getProducts` and sign in as `service-user` / `service-user`. The CSV lists 18
products. To change a price or stock for a demo, edit the product in the ERP's Products app
(`http://localhost:4004/products/webapp/index.html`, user `alice` / `alice`) and then use **Pull from ERP now** in the
shop's admin dashboard.
