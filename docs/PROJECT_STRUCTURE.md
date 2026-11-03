# NOVA Gadgets project structure

```text
nova_si/
├── README.md
├── docs/
│   └── PROJECT_STRUCTURE.md
├── erp/                    # Lab 2: Mini-ERP test data with the NOVA products (see erp/README.md)
│   └── test-data/de.fhaachen.simpleerp-Products.csv
├── test-products.json      # sample JSON import file
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── public/products/   # product images (SVG), served at /products/…
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── ProductCard.jsx
│       │   └── Modal.jsx
│       ├── context/
│       │   └── StoreContext.jsx
│       ├── pages/
│       │   ├── AccountModal.jsx
│       │   ├── CartModal.jsx
│       │   ├── CheckoutModal.jsx
│       │   ├── OrdersModal.jsx
│       │   └── AdminModal.jsx
│       ├── services/
│       │   └── api.js
│       └── styles/
│           └── global.css
└── server/
    ├── package.json
    ├── .env.example
    ├── data/erp-transfer/  # created at runtime, not in Git: inbox/, archive/, error/
    ├── src/
    │   ├── server.js
    │   ├── config/env.js
    │   ├── controllers/
    │   │   ├── adminAnalyticsController.js
    │   │   ├── authController.js
    │   │   ├── productController.js   # products, ERP import endpoints
    │   │   └── orderController.js
    │   ├── database/
    │   │   ├── db.js          # PostgreSQL pool, transactions, schema + demo data setup
    │   │   ├── schema.sql     # tables: users, products, orders, order_items, product_imports
    │   │   └── setup.sql      # one-time role + database creation (npm run db:setup)
    │   ├── middleware/auth.js
    │   ├── routes/
    │   │   ├── analyticsRoutes.js
    │   │   ├── authRoutes.js
    │   │   ├── productRoutes.js
    │   │   └── orderRoutes.js
    │   ├── services/
    │   │   ├── adminAnalyticsService.js
    │   │   ├── authService.js
    │   │   ├── erpTransferService.js    # ERP export, inbox/archive/error folders, schedule
    │   │   ├── productImportService.js  # CSV/JSON parsing, validation, import, import log
    │   │   ├── productService.js
    │   │   └── orderService.js
    │   ├── utils/errors.js
    │   └── validators/common.js
    └── tests/
        ├── productImport.test.js  # importer tests without a database
        └── smoke.test.js
```

The old empty `hooks`, `layouts`, `assets`, `utils`, and server `validators` folders can be retained if your group wants the original scaffold. They are not required by this implementation. Remove old footwear source files only after making a backup.
