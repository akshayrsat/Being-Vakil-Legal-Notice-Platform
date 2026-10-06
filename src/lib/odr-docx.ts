// Fills the approved Word templates.
// {{name}} is replaced inside each Word text run.
// [[IF]], [[ELSE]], [[END]], [[REPEAT]], and [[ROW]] are structural markers.

import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from "@xmldom/xmldom";

export type DocxModel = {
  values: Record<string, string>;
  flags: Record<string, boolean>;
  repeats: Record<string, Array<Record<string, string>>>;
  rows: Record<string, Array<Record<string, string>>>;
};

const IF_MARK = /^\[\[IF\s+([a-z0-9_]+)\]\]/i;
const REPEAT_MARK = /^\[\[REPEAT\s+([a-z0-9_]+)\]\]/i;
const ROW_MARK = /^\[\[ROW\s+([a-z0-9_]+)\]\]/i;

function paragraphText(node: Element): string {
  const parts: string[] = [];
  const texts = node.getElementsByTagName("w:t");
  for (let i = 0; i < texts.length; i += 1) parts.push(texts.item(i)?.textContent ?? "");
  return parts.join("").replace(/\u00a0/g, " ").trim();
}

function elements(parent: Node): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const child = parent.childNodes.item(i);
    if (child?.nodeType === 1) out.push(child as Element);
  }
  return out;
}

function marker(node: Element, pattern: RegExp): string | null {
  if (node.nodeName !== "w:p") return null;
  const match = paragraphText(node).match(pattern);
  return match?.[1] ?? (pattern.source.startsWith("\\[\\[ELSE") || pattern.source.startsWith("\\[\\[END") ? (paragraphText(node).match(pattern) ? "" : null) : null);
}

function isExact(node: Element, pattern: RegExp): boolean {
  return node.nodeName === "w:p" && pattern.test(paragraphText(node));
}

function fillText(node: Element, values: Record<string, string>): void {
  const texts = node.getElementsByTagName("w:t");
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts.item(i);
    if (!text?.textContent || !text.textContent.includes("{{")) continue;
    text.textContent = text.textContent.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_all, key: string) => values[key] ?? "");
  }
}

function removeRange(parent: Node, start: Element, end: Element, insert: Element[]): void {
  const after = end.nextSibling;
  let cursor: Node | null = start;
  while (cursor && cursor !== after) {
    const next: Node | null = cursor.nextSibling;
    parent.removeChild(cursor);
    cursor = next;
  }
  for (const node of insert) parent.insertBefore(node, after);
}

function findEnd(nodes: Element[], start: number, openName: string, endName: string): { end: number; elseAt: number } {
  let depth = 1;
  let elseAt = -1;
  for (let i = start + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    if (isExact(node, new RegExp(`^\\[\\[${openName}\\b`, "i"))) depth += 1;
    if (depth === 1 && endName === "END" && isExact(node, /^\[\[ELSE\]\]$/i)) elseAt = i;
    if (isExact(node, new RegExp(`^\\[\\[${endName}\\]\\]$`, "i"))) {
      depth -= 1;
      if (depth === 0) return { end: i, elseAt };
    }
  }
  throw new Error(`A template marker is missing its end (${openName}).`);
}

function processContainer(parent: Node, model: DocxModel, values: Record<string, string>): void {
  let guard = 0;
  let index = 0;
  while (index < elements(parent).length) {
    if (guard > 8000) throw new Error("The template has too many nested markers.");
    guard += 1;
    const nodes = elements(parent);
    const node = nodes[index];
    if (!node) break;
    if (node.nodeName === "w:tbl") {
      processTable(node, model, values);
      index += 1;
      continue;
    }
    const flag = marker(node, IF_MARK);
    if (flag) {
      const found = findEnd(nodes, index, "IF", "END");
      const inner = nodes.slice(index + 1, found.end);
      const elsePos = found.elseAt < 0 ? -1 : found.elseAt - index - 1;
      const chosen = elsePos < 0 ? (model.flags[flag] ? inner : []) : model.flags[flag] ? inner.slice(0, elsePos) : inner.slice(elsePos + 1);
      const clones = chosen.map((item) => item.cloneNode(true) as Element);
      removeRange(parent, node, nodes[found.end] as Element, clones);
      continue;
    }
    const repeat = marker(node, REPEAT_MARK);
    if (repeat) {
      const found = findEnd(nodes, index, "REPEAT", "END_REPEAT");
      const inner = nodes.slice(index + 1, found.end);
      const items = model.repeats[repeat] ?? [];
      const clones = items.flatMap((item) =>
        inner.map((block) => {
          const copy = block.cloneNode(true) as Element;
          fillText(copy, { ...values, ...item });
          return copy;
        }),
      );
      removeRange(parent, node, nodes[found.end] as Element, clones);
      continue;
    }
    index += 1;
  }
  fillText(parent as Element, values);
}

function processTable(table: Element, model: DocxModel, values: Record<string, string>): void {
  let guard = 0;
  let index = 0;
  const rows = () => elements(table).filter((node) => node.nodeName === "w:tr");
  while (index < rows().length) {
    if (guard > 4000) throw new Error("The template has too many table rows.");
    guard += 1;
    const current = rows();
    const row = current[index];
    if (!row) break;
    const name = paragraphText(row).match(ROW_MARK)?.[1];
    if (name) {
      const template = current[index + 1];
      if (!template || template.nodeName !== "w:tr") throw new Error(`[[ROW ${name}]] is missing the row beneath it.`);
      const items = model.rows[name] ?? [];
      const clones = items.map((item) => {
        const copy = template.cloneNode(true) as Element;
        fillText(copy, { ...values, ...item });
        return copy;
      });
      const after = template.nextSibling;
      table.removeChild(row);
      table.removeChild(template);
      for (const copy of clones) table.insertBefore(copy, after);
      for (const copy of clones) {
        for (const cell of elements(copy).filter((node) => node.nodeName === "w:tc")) processContainer(cell, model, values);
      }
      continue;
    }
    for (const cell of elements(row).filter((node) => node.nodeName === "w:tc")) processContainer(cell, model, values);
    index += 1;
  }
}

export function renderWordXml(xml: string, model: DocxModel): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const roots = ["w:body", "w:hdr", "w:ftr"];
  for (const name of roots) {
    const found = doc.getElementsByTagName(name);
    for (let i = 0; i < found.length; i += 1) {
      const root = found.item(i);
      if (root) processContainer(root, model, model.values);
    }
  }
  return new XMLSerializer().serializeToString(doc as Document);
}

export function xmlText(xml: string): string {
  return xml
    .replace(/<w:p[ >]/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const PART = /^word\/(document|header\d+|footer\d+)\.xml$/;

export async function renderDocx(template: Uint8Array, model: DocxModel): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const names = Object.keys(zip.files).filter((name) => PART.test(name));
  for (const name of names) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(name, renderWordXml(xml, model));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
