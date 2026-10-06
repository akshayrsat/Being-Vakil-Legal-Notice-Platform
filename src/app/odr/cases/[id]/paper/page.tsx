import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OdrBackLink } from "@/components/odr-back-link";
import { OdrPaperForm } from "@/components/odr-paper-form";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import {
  composeModel,
  defaultCoRespondents,
  defaultObligors,
  parsePaper,
  prefillFields,
  seatFromBatch,
  type PaperCase,
  type PaperKind,
} from "@/lib/odr-paper";
import { parsePanel } from "@/lib/odr-panel";
import { backToCase } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Prepare ODR document" };

export default async function OdrPaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const { id } = await params;
  const query = await searchParams;
  const kind: PaperKind | null = query.kind === "settlement" ? "settlement" : query.kind === "award" ? "award" : null;
  if (!kind) notFound();
  const item = await prisma.odrCase.findFirst({
    where: { id, bankId: bank.id },
    include: {
      hearings: { orderBy: { number: "asc" } },
      respondents: { orderBy: { sortOrder: "asc" }, select: { name: true, role: true, mobile: true, email: true, address: true } },
      messages: { orderBy: { createdAt: "asc" } },
      documents: { select: { kind: true, fileName: true, createdAt: true } },
      accessLogs: { where: { kind: "OPEN" }, select: { id: true } },
    },
  });
  if (!item) notFound();
  if (kind === "award" && item.matterType !== "ARBITRATION") redirect(`/odr/cases/${item.id}`);
  if (kind === "settlement" && item.matterType !== "MEDIATION") redirect(`/odr/cases/${item.id}`);
  const batch = await prisma.odrBatch.findFirst({
    where: { id: item.batchId, bankId: bank.id },
    select: { headers: true, rawRows: true },
  });
  const paper = parsePaper(item.paperJson);
  const paperCase: PaperCase = {
    matterType: item.matterType,
    refNo: item.refNo,
    customerName: item.customerName,
    coParties: item.coParties,
    respondents: item.respondents,
    accountNumber: item.accountNumber,
    branch: item.branch,
    mobile: item.mobile,
    email: item.email,
    address: item.address,
    loanAmount: item.loanAmount,
    claimAmount: item.claimAmount,
    asOnDate: item.asOnDate,
    neutralName: item.neutralName,
    neutralQualification: item.neutralQualification,
    neutralEnrolment: item.neutralEnrolment,
    panel: parsePanel(item.panelJson),
    exParte: item.exParte,
    flaggedExParte: item.flaggedExParte,
    bankCounsel: item.bankCounsel,
    paymentInfo: item.paymentInfo,
    bankName: bank.name,
    advocateName: item.advocateName,
    opens: item.accessLogs.length,
    hearings: item.hearings,
    messages: item.messages,
    documents: item.documents,
    speedPosts: [],
    agreementSeat: batch ? seatFromBatch(batch.headers, batch.rawRows, item.rowNumber) : "",
  };
  const values = prefillFields(paperCase, paper, kind);
  const preview = composeModel(paperCase, paper, kind);

  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToCase(item.id)} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">
          {kind === "award" ? "Generate award" : "Generate settlement agreement"}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank.name} vs {item.customerName}. Fields already known from the case are filled in. Interest rates stay empty, and both are required before a draft can be made. The Word file is saved on the case as v1, v2, and so on. It is not sent.
        </p>
        {query.saved === "1" ? <p className="mt-3 text-sm">Answers saved. You can generate the draft when you are ready.</p> : null}
      </div>
      <OdrPaperForm
        caseId={item.id}
        kind={kind}
        values={values}
        coRespondents={paper.coRespondents.length ? paper.coRespondents : defaultCoRespondents(paperCase)}
        obligors={paper.obligors.length ? paper.obligors : defaultObligors(paperCase)}
        instalments={paper.instalments}
        deliveries={paper.deliveries}
        hearingLines={preview.rows.hearing_log.map((row) => `Hearing ${row.hearing_no}: ${row.hearing_datetime} · ${row.hearing_respondent_attendance}`)}
        noticeLines={preview.rows.notice_log.map((row) => `${row.notice_no}. ${row.notice_description} · ${row.notice_mode} · ${row.notice_status}`)}
      />
    </DeskShell>
  );
}
