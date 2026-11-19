const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const S = require('./schema');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB = 'hc2_resource_db';
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const client = new MongoClient(URI);
let db;

const h = f => (req, res) => f(req, res).catch(e =>
  res.status(e.code === 11000 ? 409 : 500).json({ error: e.code === 11000 ? 'Duplicate key: that ID already exists' : e.message }));

// Validate + convert a request body into a typed MongoDB document
function build(name, body, partial) {
  const doc = {};
  for (const [f, type, req] of S[name].fields) {
    let v = body[f];
    if (v === undefined || v === null || v === '') {
      if (req && !partial) throw Object.assign(new Error(`${f} is required`), { bad: 1 });
      continue;
    }
    if (type === 'number') { v = Number(v); if (!Number.isFinite(v) || v < 0) throw Object.assign(new Error(`${f} must be a number >= 0`), { bad: 1 }); }
    else if (type === 'date') { v = new Date(v); if (isNaN(v)) throw Object.assign(new Error(`${f} must be a valid date`), { bad: 1 }); }
    else if (type === 'bool') v = v === true || v === 'true';
    else if (type === 'json') { try { if (typeof v === 'string') v = JSON.parse(v); } catch { throw Object.assign(new Error(`${f} must be valid JSON`), { bad: 1 }); }
      if (!Array.isArray(v) || !v.length) throw Object.assign(new Error(`${f} must be a non-empty array`), { bad: 1 }); }
    else v = String(v).trim();
    doc[f] = v;
  }
  return doc;
}
const guard = (req, res, next) => S[req.params.col] ? next() : res.status(404).json({ error: 'Unknown collection' });
const bad = (res, e) => e.bad ? res.status(400).json({ error: e.message }) : Promise.reject(e);

app.get('/api/schema', (q, r) => r.json(S));

app.get('/api/stats', h(async (q, r) => {
  const out = {};
  for (const n of Object.keys(S)) out[n] = await db.collection(n).countDocuments();
  r.json(out);
}));

// Reports from the mid-semester document (section 5), using the aggregation pipeline
app.get('/api/reports/:name', h(async (req, res) => {
  const now = new Date(), day = 864e5;
  const R = {
    'low-stock': () => db.collection('stock_batches').aggregate([
      { $group: { _id: '$drug_id', total_in_stock: { $sum: '$quantity_remaining' } } },
      { $lookup: { from: 'drugs', localField: '_id', foreignField: 'drug_id', as: 'drug' } }, { $unwind: '$drug' },
      { $match: { $expr: { $lt: ['$total_in_stock', '$drug.reorder_level'] } } },
      { $project: { _id: 0, drug_id: '$_id', name: '$drug.name', total_in_stock: 1, reorder_level: '$drug.reorder_level' } },
      { $sort: { total_in_stock: 1 } }]).toArray(),
    'expiring': () => db.collection('stock_batches').find(
      { quantity_remaining: { $gt: 0 }, expiry_date: { $lte: new Date(+now + 90 * day) } },
      { projection: { _id: 0, batch_no: 1, drug_id: 1, quantity_remaining: 1, expiry_date: 1 } }).sort({ expiry_date: 1 }).toArray(),
    'shortages': () => db.collection('prescriptions').aggregate([
      { $unwind: '$items' }, { $match: { $expr: { $lt: ['$items.qty_dispensed', '$items.qty_prescribed'] } } },
      { $group: { _id: '$items.drug_id', units_not_given: { $sum: { $subtract: ['$items.qty_prescribed', '$items.qty_dispensed'] } }, patients_affected: { $sum: 1 } } },
      { $project: { _id: 0, drug_id: '$_id', units_not_given: 1, patients_affected: 1 } }, { $sort: { units_not_given: -1 } }]).toArray(),
    'overdue': () => db.collection('requisitions').find(
      { status: { $in: ['Pending', 'Partially delivered'] }, req_date: { $lte: new Date(+now - 30 * day) } },
      { projection: { _id: 0, req_no: 1, req_date: 1, supplier_id: 1, status: 1 } }).sort({ req_date: 1 }).toArray()
  };
  if (!R[req.params.name]) return res.status(404).json({ error: 'Unknown report' });
  res.json(await R[req.params.name]());
}));

// ---- CRUD ----
app.get('/api/:col', guard, h(async (req, res) => {
  const s = S[req.params.col], q = String(req.query.q || '').trim(), filter = {};
  if (q) { const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = s.fields.filter(f => f[1] === 'text').map(f => ({ [f[0]]: rx })); }
  res.json(await db.collection(req.params.col).find(filter, { projection: { _id: 0 } }).sort({ [s.key]: 1 }).limit(500).toArray());
}));
app.get('/api/:col/:id', guard, h(async (req, res) => {
  const d = await db.collection(req.params.col).findOne({ [S[req.params.col].key]: req.params.id }, { projection: { _id: 0 } });
  d ? res.json(d) : res.status(404).json({ error: 'Not found' });
}));
app.post('/api/:col', guard, h(async (req, res) => {          // CREATE
  let doc; try { doc = build(req.params.col, req.body); } catch (e) { return bad(res, e); }
  await db.collection(req.params.col).insertOne({ ...doc });
  res.status(201).json(doc);
}));
app.put('/api/:col/:id', guard, h(async (req, res) => {       // UPDATE
  const key = S[req.params.col].key; let doc;
  try { doc = build(req.params.col, req.body, true); } catch (e) { return bad(res, e); }
  delete doc[key];
  const r = await db.collection(req.params.col).updateOne({ [key]: req.params.id }, { $set: doc });
  r.matchedCount ? res.json({ updated: true }) : res.status(404).json({ error: 'Not found' });
}));
app.delete('/api/:col/:id', guard, h(async (req, res) => {    // DELETE
  const r = await db.collection(req.params.col).deleteOne({ [S[req.params.col].key]: req.params.id });
  r.deletedCount ? res.json({ deleted: true }) : res.status(404).json({ error: 'Not found' });
}));

(async () => {
  await client.connect(); db = client.db(DB);
  for (const [n, s] of Object.entries(S)) await db.collection(n).createIndex({ [s.key]: 1 }, { unique: true });
  await db.collection('stock_batches').createIndex({ drug_id: 1, expiry_date: 1 });
  await db.collection('prescriptions').createIndex({ patient_no: 1, date: -1 });
  await db.collection('requisitions').createIndex({ status: 1, req_date: 1 });
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`HC II system running: http://localhost:${port}  (MongoDB: ${URI}/${DB})`));
})().catch(e => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });
