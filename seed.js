// Loads 30 records into EACH of the 6 collections (180 documents). Safe to re-run: it resets the data first.
const { MongoClient } = require('mongodb');
const URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
let t = 42; const rnd = () => { t |= 0; t = t + 0x6D2B79F5 | 0; let x = Math.imul(t ^ t >>> 15, 1 | t); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[ri(0, a.length - 1)];
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d)), pad = (p, n) => p + String(n).padStart(3, '0');
const dayIn = (from, to) => new Date(+from + rnd() * (+to - +from));

const drugRows = `Amoxicillin 250mg|Antibiotic|tablet|500
Artemether-Lumefantrine 20/120mg|Antimalarial|tablet|600
Oral Rehydration Salts|Rehydration|sachet|200
Paracetamol 500mg|Analgesic|tablet|800
Cotrimoxazole 480mg|Antibiotic|tablet|400
Zinc Sulphate 20mg|Supplement|tablet|300
Metronidazole 400mg|Antibiotic|tablet|300
Ciprofloxacin 500mg|Antibiotic|tablet|300
Doxycycline 100mg|Antibiotic|capsule|250
Ibuprofen 400mg|Analgesic|tablet|500
Albendazole 400mg|Antiparasitic|tablet|200
Mebendazole 100mg|Antiparasitic|tablet|200
Ferrous Sulphate 200mg|Supplement|tablet|400
Folic Acid 5mg|Supplement|tablet|400
Vitamin A 200,000IU|Supplement|capsule|150
Salbutamol 4mg|Respiratory|tablet|250
Cetirizine 10mg|Antihistamine|tablet|300
Omeprazole 20mg|Gastrointestinal|capsule|200
Fluconazole 150mg|Antifungal|capsule|100
Gentamicin 80mg|Antibiotic|ampoule|100
Diazepam 5mg|Anticonvulsant|tablet|60
Hydrocortisone cream 1%|Dermatological|tube|60
Gentian Violet|Antiseptic|bottle|40
Benzyl Benzoate lotion|Dermatological|bottle|50
Tetracycline eye ointment 1%|Ophthalmic|tube|80
Lidocaine 2%|Anaesthetic|vial|40
Normal Saline 0.9%|IV Fluid|bottle|100
Medroxyprogesterone 150mg|Family Planning|vial|80
Amlodipine 5mg|Cardiovascular|tablet|200
Metformin 500mg|Antidiabetic|tablet|300`.split('\n').map(r => r.split('|'));
const drugs = drugRows.map((r, i) => ({ drug_id: pad('D', i + 1), name: r[0], category: r[1], unit: r[2], reorder_level: +r[3], essential: i < 6 || i % 3 === 0 }));

const supRows = `National Medical Stores|Government|Entebbe|21
Joint Medical Store|Private not-for-profit|Kampala|7
District Health Office (donations/transfers)|Government|Wakiso|10
Global Fund programme supplies|Donor|Kampala|30
Medipharm Distributors|Private|Kampala|5
Mulago Hospital Pharmacy|Government|Kampala|8
Mengo Hospital Pharmacy|Private not-for-profit|Kampala|6
Wakiso District Medical Store|Government|Wakiso|9
UNICEF Uganda Supplies|Donor|Kampala|28
USAID Supply Chain|Donor|Kampala|25
PEPFAR Programme Supplies|Donor|Kampala|30
Quality Chemicals Industries|Private|Luzira|5
Kampala Pharmaceutical Industries|Private|Kampala|5
Abacus Pharma Africa|Private|Kampala|4
Pharmaplus Distributors|Private|Kampala|4
Kiwoko Hospital Pharmacy|Private not-for-profit|Nakaseke|8
Nsambya Hospital Pharmacy|Private not-for-profit|Kampala|6
Lacor Hospital Pharmacy|Private not-for-profit|Gulu|12
Entebbe Regional Referral Store|Government|Entebbe|9
Kira Municipality Health Office|Government|Kira|7
Nansana Municipal Health Office|Government|Nansana|7
Red Cross Uganda|NGO|Kampala|14
MSF Supplies|NGO|Kampala|15
Marie Stopes Uganda|NGO|Kampala|10
Reproductive Health Uganda|NGO|Kampala|12
Rotary Medical Donations|Donor|Kampala|20
Wakiso Health Partners|NGO|Wakiso|11
Mukono Medical Supplies|Private|Mukono|6
Kitende Community Pharmacy|Private|Wakiso|3
Busiro Medical Wholesalers|Private|Entebbe|6`.split('\n').map(r => r.split('|'));
const suppliers = supRows.map((r, i) => ({ supplier_id: pad('S', i + 1), name: r[0], type: r[1], town: r[2], avg_delivery_days: +r[3] }));

// patients (first 5 come from the mid-semester document)
const base = [['Nakato Grace','F',3,'Kitende A'],['Okello David','M',34,'Namulanda'],['Namutebi Sarah','F',27,'Kitende B'],['Ssemakula John','M',61,'Bwerenga'],['Atim Joan','F',8,'Namulanda']];
const fn = ['Babirye','Kato','Nansubuga','Mukasa','Nalubega','Waiswa','Akello','Opio','Nabirye','Lubega','Tendo','Nankya','Kizza','Namata','Ochieng','Birungi','Mugisha','Auma','Ssali','Nabukenya'];
const ln = ['Mary','Peter','Ruth','Moses','Esther','Isaac','Prossy','Henry','Agnes','Brian'];
const vil = ['Kitende A','Kitende B','Namulanda','Bwerenga','Kajjansi','Lweza','Abayita Ababiri','Nsangi'];
const patients = Array.from({ length: 30 }, (_, i) => {
  const [n, s, a, v] = i < 5 ? base[i] : [`${fn[i - 5 % 20]} ${pick(ln)}`, pick(['F', 'M']), ri(1, 80), pick(vil)];
  return { patient_no: pad('P', i + 1), full_name: i < 5 ? n : `${fn[(i - 5) % 20]} ${pick(ln)}`, sex: s, age: a, village: v, registered_on: dayIn(D(2026, 1, 5), D(2026, 10, 10)) };
});

// stock batches: one per drug; some empty, some below reorder level, some near expiry
const batches = drugs.map((d, i) => {
  const recv = d.reorder_level * ri(3, 6);
  const rem = i === 4 || i % 7 === 3 ? 0 : i % 5 === 1 ? Math.floor(d.reorder_level * rnd() * 0.9) : Math.floor(recv * (0.3 + rnd() * 0.6));
  return { batch_no: pad('B', i + 1), drug_id: d.drug_id, supplier_id: pick(suppliers).supplier_id, quantity_received: recv, quantity_remaining: rem,
    received_date: dayIn(D(2026, 2, 1), D(2026, 9, 30)), expiry_date: i % 6 === 0 ? dayIn(D(2026, 11, 15), D(2027, 1, 10)) : dayIn(D(2027, 3, 1), D(2028, 12, 31)), location: pick(['Main store', 'Dispensary']) };
});
const stock = id => batches.filter(b => b.drug_id === id).reduce((s, b) => s + b.quantity_remaining, 0);

// prescriptions: out-of-stock drugs are recorded as unmet (shortfall_reason)
const dx = { Malaria: ['D002', 'D004'], 'Urinary tract infection': ['D005', 'D004'], 'Chest infection': ['D001', 'D004'], Diarrhoea: ['D003', 'D006'], 'Intestinal worms': ['D011'], Anaemia: ['D013', 'D014'], Asthma: ['D016'], Scabies: ['D024'], Hypertension: ['D029'], Diabetes: ['D030'], 'Fungal infection': ['D019'], 'Skin infection': ['D009', 'D023'] };
const prescriptions = Array.from({ length: 30 }, (_, i) => {
  const diag = pick(Object.keys(dx));
  const items = dx[diag].map(id => { const q = ri(5, 28), ok = stock(id) >= q; return ok ? { drug_id: id, qty_prescribed: q, qty_dispensed: q } : { drug_id: id, qty_prescribed: q, qty_dispensed: 0, shortfall_reason: 'Out of stock' }; });
  return { rx_no: pad('RX', i + 1), patient_no: pick(patients).patient_no, date: dayIn(D(2026, 9, 1), D(2026, 11, 8)), diagnosis: diag, prescribed_by: pick(['Clinical Officer', 'Nurse', 'Midwife']), items };
});

// requisitions
const reqs = Array.from({ length: 30 }, (_, i) => {
  const status = ['Delivered', 'Delivered', 'Partially delivered', 'Pending'][i % 4];
  const items = Array.from({ length: ri(1, 2) }, () => { const r = ri(2, 10) * 100; return { drug_id: pick(drugs).drug_id, qty_requested: r, qty_delivered: status === 'Delivered' ? r : status === 'Pending' ? 0 : Math.floor(r * 0.6) }; });
  return { req_no: pad('REQ', i + 1), req_date: status === 'Pending' ? dayIn(D(2026, 8, 1), D(2026, 10, 30)) : dayIn(D(2026, 4, 1), D(2026, 9, 15)), supplier_id: pick(suppliers).supplier_id, status, requested_by: pick(['In-charge', 'Clinical Officer', 'Nurse']), items };
});

(async () => {
  const c = new MongoClient(URI); await c.connect(); const db = c.db('hc2_resource_db');
  const data = { drugs, suppliers, stock_batches: batches, patients, prescriptions, requisitions: reqs };
  for (const [n, rows] of Object.entries(data)) {
    await db.collection(n).deleteMany({}); await db.collection(n).insertMany(rows);
    console.log(`${n.padEnd(14)} ${rows.length} documents inserted`);
  }
  await c.close();
})().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
