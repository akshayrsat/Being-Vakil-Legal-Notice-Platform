// Customer-page text. English is filled in. Hindi and Marathi use the same keys later.

export type OdrCopy = {
  localeName: string;
  pageTitle: string;
  firmLine: string;
  verifyTitle: string;
  verifyBody: string;
  verifyLabel: string;
  verifyButton: string;
  verifyFailed: string;
  verifyLocked: string;
  verifyUnavailable: string;
  caseHeading: string;
  partyHeading: string;
  disputeHeading: string;
  documentsHeading: string;
  noDocuments: string;
  whoHeading: string;
  rulesHeading: string;
  rules: string[];
  neutralHeading: string;
  independenceArbitration: string;
  independenceMediation: string;
  timelineHeading: string;
  nextHearing: string;
  noHearing: string;
  join: string;
  addToCalendar: string;
  practiceMeet: string;
  rescheduleHeading: string;
  rescheduleBody: string;
  rescheduleNote: string;
  rescheduleWhen: string;
  rescheduleButton: string;
  rescheduleReceived: string;
  uploadHeading: string;
  uploadBody: string;
  uploadButton: string;
  settleHeading: string;
  settleBody: string;
  settleAmount: string;
  settleNote: string;
  settleButton: string;
  settleReceived: string;
  advocateHeading: string;
  advocateName: string;
  advocateBar: string;
  advocateButton: string;
  contactHeading: string;
  paymentHeading: string;
  confidential: string;
};

const ENGLISH: OdrCopy = {
  localeName: "English",
  pageTitle: "Your hearing",
  firmLine: "Being Vakil Associates",
  verifyTitle: "Confirm this is your account",
  verifyBody:
    "Enter the last 4 digits of the loan or card account number in the message you received. We show the case only after that matches.",
  verifyLabel: "Last 4 digits",
  verifyButton: "Show the case",
  verifyFailed: "Those digits do not match this case. Check the account number and try again.",
  verifyLocked: "Too many attempts. Wait a few minutes and try again.",
  verifyUnavailable: "This case cannot be opened online. Please call Being Vakil Associates on +91 9653331393.",
  caseHeading: "Case reference and party details",
  partyHeading: "Parties",
  disputeHeading: "Dispute summary and documents",
  documentsHeading: "Documents",
  noDocuments: "No documents have been placed on this page yet.",
  whoHeading: "Who will join",
  rulesHeading: "Hearing rules",
  rules: [
    "Join at least 10 minutes before the scheduled time.",
    "Keep a photo identity document with you.",
    "Keep your camera on during the hearing.",
    "Parties must not record the hearing.",
    "The hearing is confidential.",
    "If you do not appear, the matter may proceed ex parte.",
  ],
  neutralHeading: "Who is hearing the matter",
  independenceArbitration:
    "The arbitrator has disclosed, in terms of Section 12 of the Arbitration and Conciliation Act, 1996, that there are no circumstances likely to give rise to justifiable doubts as to independence or impartiality.",
  independenceMediation:
    "The mediator is independent of the parties and does not decide the dispute. A settlement is recorded only if the parties agree.",
  timelineHeading: "Timeline and session",
  nextHearing: "Next hearing",
  noHearing: "The next hearing date will appear here when it is fixed.",
  join: "Join hearing",
  addToCalendar: "Add to calendar",
  practiceMeet: "The hearing link on this case is a practice link. A live Google Meet link will replace it before the hearing.",
  rescheduleHeading: "Ask for another date",
  rescheduleBody: "You may make one request. The firm will confirm if another date is given.",
  rescheduleNote: "Reason",
  rescheduleWhen: "Date you can attend",
  rescheduleButton: "Send request",
  rescheduleReceived: "Your request has been sent to the firm.",
  uploadHeading: "Send a document",
  uploadBody: "You may upload a reply, a statement of defence, or proof of payment. PDF only.",
  uploadButton: "Upload",
  settleHeading: "Want to settle?",
  settleBody: "Tell the firm the amount you offer and a short note. This does not by itself close the case.",
  settleAmount: "Amount you offer",
  settleNote: "Note",
  settleButton: "Send offer",
  settleReceived: "Your offer has been sent to the firm. It is also shown on the case.",
  advocateHeading: "Your advocate",
  advocateName: "Advocate name",
  advocateBar: "Bar enrolment number",
  advocateButton: "Save advocate",
  contactHeading: "Bank contact",
  paymentHeading: "Payment",
  confidential: "This page is for the parties to this case. Do not forward the link.",
};

export const odrCopyCatalog: Record<"en" | "hi" | "mr", OdrCopy | null> = {
  en: ENGLISH,
  hi: null,
  mr: null,
};

const MEDIATION_RULES = [
  "You are invited to a voluntary mediation session. You may join or decline.",
  "Joining a few minutes early gives everyone time to connect.",
  "A photo identity document helps the mediator know who is present.",
  "Please keep your camera on if you can.",
  "Please do not record the session.",
  "The session is confidential.",
  "A settlement is recorded only if everyone agrees. Nothing is decided against a person who does not join.",
];

export function odrCopy(locale = "en"): OdrCopy {
  if (locale === "hi" && odrCopyCatalog.hi) return odrCopyCatalog.hi;
  if (locale === "mr" && odrCopyCatalog.mr) return odrCopyCatalog.mr;
  return ENGLISH;
}

export function odrCopyFor(matterType: string): OdrCopy {
  const copy = odrCopy("en");
  if (matterType !== "MEDIATION") return copy;
  return {
    ...copy,
    pageTitle: "Your mediation session",
    rulesHeading: "About this session",
    rules: MEDIATION_RULES,
    nextHearing: "Next session",
    noHearing: "The next session date will appear here if one is arranged.",
    join: "Join session",
    rescheduleBody: "You may ask for another date. Joining is voluntary.",
    settleBody: "If you want to propose a settlement, send the amount and a short note. It is recorded only if the parties agree.",
  };
}
