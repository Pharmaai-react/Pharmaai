export const USERS = {
  'admin': { password: 'admin123', name: 'Dr. Smith', role: 'Administrator', initials: 'DS' },
  'doctor': { password: 'pharma2024', name: 'Dr. Johnson', role: 'Pharmacist', initials: 'DJ' },
  'staff': { password: 'staff123', name: 'Sarah Khan', role: 'Staff Member', initials: 'SK' }
};

export const initialInventoryData = [
  { name: 'Paracetamol 500mg', category: 'Analgesics', stock: 85, quantity: 4250, expiry: '2025-12-15', status: 'in-stock' },
  { name: 'Amoxicillin 250mg', category: 'Antibiotics', stock: 45, quantity: 900, expiry: '2025-02-20', status: 'expiring' },
  { name: 'Metformin 850mg', category: 'Antidiabetics', stock: 72, quantity: 2160, expiry: '2026-03-10', status: 'in-stock' },
  { name: 'Insulin Glargine', category: 'Antidiabetics', stock: 15, quantity: 45, expiry: '2025-08-22', status: 'critical' },
  { name: 'Omeprazole 20mg', category: 'Gastrointestinal', stock: 38, quantity: 760, expiry: '2025-04-05', status: 'low-stock' },
  { name: 'Amlodipine 5mg', category: 'Cardiovascular', stock: 92, quantity: 2760, expiry: '2026-06-18', status: 'in-stock' },
  { name: 'Lisinopril 10mg', category: 'Cardiovascular', stock: 28, quantity: 560, expiry: '2025-09-30', status: 'low-stock' },
  { name: 'Salbutamol Inhaler', category: 'Respiratory', stock: 65, quantity: 130, expiry: '2025-11-12', status: 'in-stock' },
  { name: 'Atorvastatin 20mg', category: 'Cardiovascular', stock: 78, quantity: 2340, expiry: '2026-01-25', status: 'in-stock' },
  { name: 'Ceftriaxone 1g', category: 'Antibiotics', stock: 22, quantity: 88, expiry: '2025-07-08', status: 'low-stock' }
];

export const initialMedicineDB = [
  { barcode: '8901234567890', name: 'Paracetamol 500mg', category: 'Analgesics', price: 2.50, stock: 4250, unit: 'Tablet' },
  { barcode: '8902345678901', name: 'Amoxicillin 250mg', category: 'Antibiotics', price: 8.00, stock: 900, unit: 'Capsule' },
  { barcode: '8903456789012', name: 'Metformin 850mg', category: 'Antidiabetics', price: 4.50, stock: 2160, unit: 'Tablet' },
  { barcode: '8904567890123', name: 'Insulin Glargine', category: 'Antidiabetics', price: 180.00, stock: 45, unit: 'Vial' },
  { barcode: '8905678901234', name: 'Omeprazole 20mg', category: 'Gastro', price: 6.00, stock: 760, unit: 'Capsule' },
  { barcode: '8906789012345', name: 'Amlodipine 5mg', category: 'Cardiovascular', price: 3.50, stock: 2760, unit: 'Tablet' },
  { barcode: '8907890123456', name: 'Lisinopril 10mg', category: 'Cardiovascular', price: 5.00, stock: 560, unit: 'Tablet' },
  { barcode: '8908901234567', name: 'Salbutamol Inhaler', category: 'Respiratory', price: 95.00, stock: 130, unit: 'Inhaler' },
  { barcode: '8909012345678', name: 'Atorvastatin 20mg', category: 'Cardiovascular', price: 12.00, stock: 2340, unit: 'Tablet' },
  { barcode: '8900123456789', name: 'Ceftriaxone 1g', category: 'Antibiotics', price: 220.00, stock: 88, unit: 'Vial' },
  { barcode: '6901234567890', name: 'Vitamin D3 1000 IU', category: 'Supplements', price: 3.00, stock: 500, unit: 'Tablet' },
  { barcode: '6902345678901', name: 'Cetirizine 10mg', category: 'Antihistamine', price: 1.80, stock: 800, unit: 'Tablet' },
];

export const CHART_DATA = {
  week: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dispensed: [420, 380, 510, 470, 550, 320, 280],
    received: [200, 450, 150, 600, 350, 100, 50]
  },
  month: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    dispensed: [2800, 3100, 2950, 3400],
    received: [1500, 2200, 1800, 2500]
  },
  year: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dispensed: [10500, 11200, 10800, 12100, 11500, 10900, 10200, 11800, 12300, 11900, 12100, 12800],
    received: [8500, 9200, 8800, 10100, 9500, 8900, 8200, 9800, 10300, 9900, 10100, 10800]
  }
};

export function formatDate(s) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatStatus(s) {
  return { 'in-stock': 'In Stock', 'low-stock': 'Low Stock', 'critical': 'Critical', 'expiring': 'Expiring Soon' }[s] || s;
}
