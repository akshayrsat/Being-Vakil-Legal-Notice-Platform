// Practice banks created every time the site starts.
// The bank viewer practice login is tied to the one marked forViewer.
// If you change a code or name here, say the same thing in the README.

export type DemoBank = {
  name: string;
  code: string;
  active: boolean;
  forViewer: boolean;
};

export const DEMO_BANKS: DemoBank[] = [
  {
    name: "Northwind Housing Finance",
    code: "NWH",
    active: true,
    forViewer: true,
  },
  {
    name: "Meridian Co-operative Bank",
    code: "MCB",
    active: true,
    forViewer: false,
  },
  {
    name: "Harbour Credit",
    code: "HCR",
    active: false,
    forViewer: false,
  },
];
