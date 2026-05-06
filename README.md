# CachePrint's IMS — Express Backend

## Folder Structure
```
cacheprints-backend/
├── server.js                  ← Entry point — run this
├── package.json
├── .env.example               ← Copy to .env
├── config/
│   └── db.js                  ← MongoDB connection
├── middleware/
│   ├── auth.js                ← protect + adminOnly
│   └── errorHandler.js        ← global error handler
├── models/                    ← All 8 Mongoose models (copied from db package)
│   ├── User.js
│   ├── Material.js
│   ├── Order.js
│   ├── Purchase.js
│   ├── Transaction.js
│   ├── ActivityLog.js
│   ├── Product.js
│   ├── Settings.js
│   └── index.js
├── controllers/
│   ├── authController.js      ← login, signup, verifyAdmin, me, updateProfile, changePassword
│   ├── userController.js      ← getAllUsers, getActiveUsers, archiveUser, restoreUser
│   ├── materialController.js  ← CRUD + adjustStock + archive/restore/delete
│   ├── orderController.js     ← CRUD + complete + advance + archive/restore/delete
│   ├── purchaseController.js  ← getPurchases, addPurchase, receivePurchase
│   └── miscController.js      ← transactions, activityLog, settings, dashboard
└── routes/
    ├── authRoutes.js
    ├── userRoutes.js
    ├── materialRoutes.js
    ├── orderRoutes.js
    └── otherRoutes.js
```

---

## All API Endpoints

### Auth  `/api/auth`
| Method | Endpoint              | Access  | Description                        |
|--------|-----------------------|---------|------------------------------------|
| POST   | /login                | Public  | Login → returns JWT + user         |
| POST   | /signup               | Public  | Create account (needs admin creds) |
| POST   | /verify-admin         | Public  | Verify admin credentials           |
| GET    | /me                   | Private | Get current logged-in user         |
| PUT    | /update-profile       | Private | Update name/email/contact          |
| PUT    | /change-password      | Private | Change password                    |

### Users  `/api/users`
| Method | Endpoint              | Access        | Description              |
|--------|-----------------------|---------------|--------------------------|
| GET    | /                     | Private/Admin | Get all users            |
| GET    | /active               | Private       | Get active users only    |
| PATCH  | /:id/archive          | Private/Admin | Archive a user           |
| PATCH  | /:id/restore          | Private/Admin | Restore archived user    |

### Materials  `/api/materials`
| Method | Endpoint              | Access        | Description                  |
|--------|-----------------------|---------------|------------------------------|
| GET    | /                     | Private       | Get all active materials     |
| GET    | /archived             | Private/Admin | Get archived materials       |
| POST   | /                     | Private       | Add new material             |
| PUT    | /:id                  | Private       | Update material info         |
| PATCH  | /:id/adjust           | Private/Admin | Adjust stock quantity        |
| PATCH  | /:id/archive          | Private/Admin | Archive material             |
| PATCH  | /:id/restore          | Private/Admin | Restore material             |
| DELETE | /:id                  | Private/Admin | Permanently delete material  |

### Orders  `/api/orders`
| Method | Endpoint              | Access        | Description                      |
|--------|-----------------------|---------------|----------------------------------|
| GET    | /                     | Private       | Get all active orders            |
| GET    | /archived             | Private/Admin | Get archived orders              |
| POST   | /                     | Private       | Create new job order             |
| PUT    | /:id                  | Private       | Update order details             |
| PATCH  | /:id/complete         | Private       | Mark order as complete           |
| PATCH  | /:id/advance          | Private       | Advance production stage         |
| PATCH  | /:id/archive          | Private/Admin | Archive order                    |
| PATCH  | /:id/restore          | Private/Admin | Restore order                    |
| DELETE | /:id                  | Private/Admin | Permanently delete order         |

### Purchases  `/api/purchases`
| Method | Endpoint              | Access  | Description                          |
|--------|-----------------------|---------|--------------------------------------|
| GET    | /                     | Private | Get all purchases                    |
| POST   | /                     | Private | Record new purchase                  |
| PATCH  | /:id/receive          | Private | Mark as received + update stock      |

### Transactions  `/api/transactions`
| Method | Endpoint  | Access  | Description              |
|--------|-----------|---------|--------------------------|
| GET    | /         | Private | Get all transactions     |

### Activity Log  `/api/activity-log`
| Method | Endpoint  | Access        | Description          |
|--------|-----------|---------------|----------------------|
| GET    | /         | Private/Admin | Get all log entries  |

### Settings  `/api/settings`
| Method | Endpoint  | Access        | Description           |
|--------|-----------|---------------|-----------------------|
| GET    | /         | Private       | Get settings          |
| PUT    | /         | Private/Admin | Update settings       |

### Dashboard  `/api/dashboard`
| Method | Endpoint  | Access  | Description                             |
|--------|-----------|---------|-----------------------------------------|
| GET    | /         | Private | All dashboard data in one request       |

---

## Request / Response Format

Every response follows this shape:
```json
{ "ok": true,  "data": ... }
{ "ok": false, "error": "message" }
```

## Auth Header
All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```
