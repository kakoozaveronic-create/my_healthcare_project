# Health Centre II Resource Management System
MongoDB + Node.js/Express (backend) + HTML/CSS/JavaScript (front end).
Based on the mid-semester case: *Managing Drugs and Resources in a Government Health Centre II Using MongoDB* (database `hc2_resource_db`).

## Run it
1. Install Node.js (v18+) and MongoDB Community (or just keep MongoDB Compass connected to `mongodb://localhost:27017`).
2. In this folder:
   ```
   npm install
   npm run seed     # inserts 30 documents into each of the 6 collections (180 total)
   npm start        # open http://localhost:3000
   ```
   Different MongoDB address? `MONGO_URI="mongodb://host:27017" npm start`

## CRUD
| Operation | HTTP | MongoDB call | In the UI |
|---|---|---|---|
| Create | POST /api/:collection | insertOne | "+ Add" |
| Read | GET /api/:collection, GET /api/:collection/:id | find / findOne | tables + search box |
| Update | PUT /api/:collection/:id | updateOne ($set) | "Edit" |
| Delete | DELETE /api/:collection/:id | deleteOne | "Delete" |

Works for all six collections: drugs, suppliers, stock_batches, patients, prescriptions, requisitions.

## Robustness features
- Server-side validation (required fields, numbers >= 0, valid dates, valid JSON items array) -> HTTP 400
- Unique index on every ID field -> duplicate IDs rejected (HTTP 409); unknown ID -> 404
- Extra indexes from the document (drug_id+expiry_date, patient_no+date, status+req_date)
- Search is regex-escaped (safe against regex injection)
- Dashboard uses aggregation pipelines: low stock, expiring in 90 days, unmet prescriptions, overdue requisitions (document section 5)

## Files
`server.js` API · `schema.js` collections/fields (shared by API validation and UI) · `seed.js` 30 entries per collection · `public/index.html` front end
