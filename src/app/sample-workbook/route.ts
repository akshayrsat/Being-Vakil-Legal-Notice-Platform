// Lets someone download the practice spreadsheet from the upload page.

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "samples", "notice-recipients.xlsx");
  try {
    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="notice-recipients.xlsx"',
      },
    });
  } catch {
    return new Response("The practice spreadsheet is missing.", { status: 404 });
  }
}
