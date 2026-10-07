import { prisma } from "./db";
import {
  DEFAULT_PRIVACY_EMAIL,
  DEFAULT_PRIVACY_PHONE,
  DEFAULT_REQUEST_DUE_DAYS,
  privacyOfficerLabel,
} from "./privacy-copy";

export const FIRM_PRIVACY_ID = "firm";

export type FirmPrivacy = {
  officerName: string;
  officerLabel: string;
  officerEmail: string;
  officerPhone: string;
  requestDueDays: number;
};

export type BankRetentionView = {
  closedCaseDays: number;
  messageDays: number;
  documentDays: number;
  publicNoticeDays: number;
  campaignDays: number;
  legalHold: boolean;
};

const EMPTY_RETENTION: BankRetentionView = {
  closedCaseDays: 0,
  messageDays: 0,
  documentDays: 0,
  publicNoticeDays: 0,
  campaignDays: 0,
  legalHold: false,
};

export async function readFirmPrivacy(): Promise<FirmPrivacy> {
  const row = await prisma.firmPrivacySetting.findUnique({ where: { id: FIRM_PRIVACY_ID } });
  const officerName = row?.officerName ?? "";
  const due = row?.requestDueDays ?? DEFAULT_REQUEST_DUE_DAYS;
  return {
    officerName,
    officerLabel: privacyOfficerLabel(officerName),
    officerEmail: row?.officerEmail?.trim() || DEFAULT_PRIVACY_EMAIL,
    officerPhone: row?.officerPhone?.trim() || DEFAULT_PRIVACY_PHONE,
    requestDueDays: Number.isInteger(due) && due >= 1 && due <= 365 ? due : DEFAULT_REQUEST_DUE_DAYS,
  };
}

export async function readBankRetention(bankId: string): Promise<BankRetentionView> {
  if (!bankId) return EMPTY_RETENTION;
  const row = await prisma.bankRetention.findUnique({ where: { bankId } });
  if (!row) return EMPTY_RETENTION;
  return {
    closedCaseDays: row.closedCaseDays,
    messageDays: row.messageDays,
    documentDays: row.documentDays,
    publicNoticeDays: row.publicNoticeDays,
    campaignDays: row.campaignDays,
    legalHold: row.legalHold,
  };
}
