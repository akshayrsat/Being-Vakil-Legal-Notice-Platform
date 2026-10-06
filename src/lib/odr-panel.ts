// The people who hear a case. Split mode stores one person. Panel mode stores every member.

export type PanelMember = {
  id: string;
  name: string;
  qualification: string;
  enrolment: string;
};

export function parsePanel(raw: string | null | undefined): PanelMember[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<PanelMember>;
      const name = String(row.name ?? "").trim();
      if (!name) return [];
      return [{
        id: String(row.id ?? "").trim(),
        name,
        qualification: String(row.qualification ?? "").trim(),
        enrolment: String(row.enrolment ?? "").trim(),
      }];
    });
  } catch {
    return [];
  }
}

export function panelJson(members: PanelMember[]): string {
  return JSON.stringify(members.map((member) => ({
    id: member.id,
    name: member.name,
    qualification: member.qualification,
    enrolment: member.enrolment,
  })));
}

export function joinNames(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

export function tribunalHeading(count: number): string {
  return count > 1 ? "Arbitral Tribunal" : "Sole Arbitrator";
}

export function tribunalRole(count: number): string {
  return count > 1 ? "Arbitrator" : "Sole Arbitrator";
}
