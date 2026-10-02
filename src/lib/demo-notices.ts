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
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
};

export const DEMO_NOTICES: DemoNotice[] = [
  {
    seedKey: "demo-akshay-sathe",
    noticeNumber: "DEMO-LN10021",
    customerName: "Akshay Sathe",
    address: "14, Shivaji Nagar, Pune 411005",
    loanNumber: "LN10021",
    customerId: "CUST501",
    loanAmount: "500000",
    outstandingAmount: "125000",
    loanType: "Home Loan",
    referenceNumber: "DEMO-LN10021",
    collectionManager: "",
    collectionManagerMobile: "",
    bankWebsite: "",
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
    loanType: "Personal Loan",
    referenceNumber: "DEMO-LN10022",
    collectionManager: "",
    collectionManagerMobile: "",
    bankWebsite: "",
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
    loanType: "Housing Loan",
    referenceNumber: "DEMO-LN10023",
    collectionManager: "",
    collectionManagerMobile: "",
    bankWebsite: "",
  },
];
