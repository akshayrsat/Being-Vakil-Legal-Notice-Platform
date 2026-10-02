// Three practice notices. Starting the site puts these pages back.
// The people match samples/notice-recipients.xlsx.

export type DemoNotice = {
  seedKey: string;
  noticeNumber: string;
  customerName: string;
  address: string;
  loanNumber: string;
  customerId: string;
  loanAmount: string;
  outstandingAmount: string;
  body: string;
};

const PRACTICE_PEOPLE = [
  {
    seedKey: "demo-akshay-sathe",
    noticeNumber: "DEMO-LN10021",
    customerName: "Akshay Sathe",
    address: "14, Shivaji Nagar, Pune 411005",
    loanNumber: "LN10021",
    customerId: "CUST501",
    loanAmount: "500000",
    outstandingAmount: "125000",
  },
  {
    seedKey: "demo-akshay-r-sathe",
    noticeNumber: "DEMO-LN10022",
    customerName: "Akshay R Sathe",
    address: "22, Law College Road, Pune 411004",
    loanNumber: "LN10022",
    customerId: "CUST502",
    loanAmount: "250000",
    outstandingAmount: "80000",
  },
  {
    seedKey: "demo-shweta-sudhir",
    noticeNumber: "DEMO-LN10023",
    customerName: "Shweta Sudhir",
    address: "8, FC Road, Pune 411004",
    loanNumber: "LN10023",
    customerId: "CUST503",
    loanAmount: "750000",
    outstandingAmount: "210000",
  },
] as const;

export const DEMO_NOTICES: DemoNotice[] = PRACTICE_PEOPLE.map((person) => ({
  ...person,
  body: practiceBody(person),
}));

function practiceBody(person: (typeof PRACTICE_PEOPLE)[number]): string {
  return [
    `Under instructions from our client, we call upon you, ${person.customerName}, to pay the outstanding amount on loan ${person.loanNumber} (customer id ${person.customerId}).`,
    "",
    `The loan amount on record is Rs ${person.loanAmount}. The outstanding amount on record is Rs ${person.outstandingAmount}. Please pay that outstanding amount within 15 days of reading this notice.`,
    "",
    "If the outstanding amount remains unpaid, our client may take the next steps available under the loan agreement.",
    "",
    "This is a practice notice for a local demonstration.",
  ].join("\n");
}
