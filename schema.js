// Single source of truth: used by the API (validation) and the front end (forms/tables).
// field = [name, type, required]   types: text | number | date | bool | json
module.exports = {
  drugs: { key: 'drug_id', title: 'Drugs', fields: [['drug_id','text',1],['name','text',1],['category','text',1],['unit','text',1],['reorder_level','number',1],['essential','bool']] },
  suppliers: { key: 'supplier_id', title: 'Suppliers', fields: [['supplier_id','text',1],['name','text',1],['type','text',1],['town','text',1],['avg_delivery_days','number',1]] },
  stock_batches: { key: 'batch_no', title: 'Stock Batches', fields: [['batch_no','text',1],['drug_id','text',1],['supplier_id','text',1],['quantity_received','number',1],['quantity_remaining','number',1],['received_date','date',1],['expiry_date','date',1],['location','text',1]] },
  patients: { key: 'patient_no', title: 'Patients', fields: [['patient_no','text',1],['full_name','text',1],['sex','text',1],['age','number',1],['village','text',1],['registered_on','date',1]] },
  prescriptions: { key: 'rx_no', title: 'Prescriptions', fields: [['rx_no','text',1],['patient_no','text',1],['date','date',1],['diagnosis','text',1],['prescribed_by','text',1],['items','json',1]] },
  requisitions: { key: 'req_no', title: 'Requisitions', fields: [['req_no','text',1],['req_date','date',1],['supplier_id','text',1],['status','text',1],['requested_by','text',1],['items','json',1]] }
};
