# NOVA Gadgets project structure

```text
nova_si/
├── README.md
├── docs/
│   └── PROJECT_STRUCTURE.md
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
    ├── src/
    │   ├── server.js
    │   ├── config/env.js
    │   ├── controllers/
    │   │   ├── authController.js
    │   │   ├── productController.js
    │   │   └── orderController.js
    │   ├── database/
    │   │   ├── db.js          # PostgreSQL pool, transactions, schema + demo data setup
    │   │   ├── schema.sql     # tables: users, products, orders, order_items
    │   │   └── setup.sql      # one-time role + database creation (npm run db:setup)
    │   ├── middleware/auth.js
    │   ├── routes/
    │   │   ├── authRoutes.js
    │   │   ├── productRoutes.js
    │   │   └── orderRoutes.js
    │   ├── services/
    │   │   ├── authService.js
    │   │   ├── productService.js
    │   │   └── orderService.js
    │   ├── utils/errors.js
    │   └── validators/common.js
    └── tests/smoke.test.js
```

The old empty `hooks`, `layouts`, `assets`, `utils`, and server `validators` folders can be retained if your group wants the original scaffold. They are not required by this implementation. Remove old footwear source files only after making a backup.
