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
  "Loan type",
  "Reference number",
  "Collection manager",
  "Collection manager mobile",
  "Bank website",
  "Co-borrower name",
  "Co-borrower mobile",
  "Co-borrower email",
  "Guarantor name",
  "Guarantor mobile",
  "Guarantor email",
];

// The only practice recipients. Do not add other names or mobile numbers.
const rows = [
  ["Akshay Sathe", "9619871393", "", "akshayrsathe@gmail.com", "14, Shivaji Nagar, Pune 411005", "LN10021", "CUST501", 500000, 125000, "Home Loan", "", "", "", "", "", "", "", "", "", ""],
  ["Akshay R Sathe", "8828402800", "", "akshayrsat@gmail.com", "22, Law College Road, Pune 411004", "LN10022", "CUST502", 250000, 80000, "Personal Loan", "", "", "", "", "", "", "", "", "", ""],
  ["Shweta Sudhir", "9326247985", "", "advshwetasudhir@gmail.com", "8, FC Road, Pune 411004", "LN10023", "CUST503", 750000, 210000, "Housing Loan", "", "", "", "", "", "", "", "", "", ""],
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
