// Builds samples/notice-recipients.xlsx. Run: node scripts/make-sample-workbook.mjs

import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const headers = [
  "Customer name",
  "Mobile",
  "Mobile 2",
  "Email",
  "Address",
  "Loan number",
  "Customer id",
  "Loan amount",
  "Outstanding amount",
  "Co-borrower name",
  "Co-borrower mobile",
  "Co-borrower email",
  "Guarantor name",
  "Guarantor mobile",
  "Guarantor email",
];

const rows = [
  ["Anita Deshmukh", "9876543210", "9876500001", "anita.deshmukh@example.com", "12 MG Road, Pune 411001", "LN10021", "CUST501", 500000, 125000, "Ravi Deshmukh", "9876500002", "ravi.deshmukh@example.com", "Suresh Patil", "9876500003", "suresh.patil@example.com"],
  ["Kiran Joshi", "9811111111 / 9822222222", "", "", "4 Lake View, Nashik 422001", "LN10022", "CUST502", 250000, 80000, "Neha Joshi", "9833333333", "", "", "", ""],
  ["Farah Qureshi", "9844444444", "", "farah.qureshi@example.com", "88 Banjara Hills, Hyderabad 500034", "LN10023", "CUST503", 750000, 210000, "", "", "", "Imran Qureshi", "9855555555", ""],
  ["Joseph D'Souza", "9766666666", "9766666667", "joseph.dsouza@example.com", "2 Panaji Market, Goa 403001", "LN10024", "CUST504", 180000, 45000, "Maria D'Souza", "9766666668", "maria.dsouza@example.com", "", "", ""],
  ["Meenakshi Nair", "9898989898", "", "", "15 Marine Drive, Kochi 682031", "LN10025", "CUST505", 320000, 96000, "", "", "", "", "", ""],
  ["Harpreet Singh", "9810012345", "9810012346", "harpreet.singh@example.com", "77 Model Town, Ludhiana 141002", "LN10026", "CUST506", 410000, 150000, "Simran Singh", "9810012347", "simran.singh@example.com", "Baljit Singh", "9810012348", "baljit.singh@example.com"],
  ["Lakshmi Rao", "9900001111", "", "lakshmi.rao@example.com", "9 Abids, Hyderabad 500001", "LN10027", "CUST507", 275000, 60000, "Venkat Rao", "9900001112", "", "Padma Rao", "9900001113", "padma.rao@example.com"],
  ["Imran Sheikh", "9822003344", "9822003345", "", "21 Charminar Road, Hyderabad 500002", "LN10028", "CUST508", 190000, 70000, "", "", "", "Yusuf Sheikh", "9822003346", "yusuf.sheikh@example.com"],
  ["Priya Menon", "9744556677", "", "priya.menon@example.com", "6 MG Road, Bengaluru 560001", "LN10029", "CUST509", 640000, 300000, "Arun Menon", "9744556678", "arun.menon@example.com", "", "", ""],
  ["Vikram Bedi", "9818181818", "", "vikram.bedi@example.com", "33 Connaught Place, Delhi 110001", "LN10030", "CUST510", 900000, 450000, "", "", "", "Asha Bedi", "9818181819", ""],
  ["Sneha Kulkarni", "9888877777, 9888866666", "", "sneha.kulkarni@example.com", "18 FC Road, Pune 411004", "LN10031", "CUST511", 220000, 55000, "Amit Kulkarni", "9888855555", "", "", "", ""],
  ["Abdul Rahman", "9797979797", "9797979798", "abdul.rahman@example.com", "5 Park Street, Kolkata 700016", "LN10032", "CUST512", 360000, 110000, "Amina Rahman", "9797979799", "amina.rahman@example.com", "Karim Rahman", "9797979700", "karim.rahman@example.com"],
];

const outDir = path.join(process.cwd(), "samples");
await mkdir(outDir, { recursive: true });

const workbook = new ExcelJS.Workbook();
workbook.creator = "Notice Desk";
const sheet = workbook.addWorksheet("Recipients");
sheet.addRow(headers);
for (const row of rows) sheet.addRow(row);
sheet.getRow(1).font = { bold: true };
sheet.columns.forEach((column) => {
  column.width = 24;
});

const outFile = path.join(outDir, "notice-recipients.xlsx");
await workbook.xlsx.writeFile(outFile);
console.log(`Wrote ${rows.length} practice rows to ${outFile}`);
