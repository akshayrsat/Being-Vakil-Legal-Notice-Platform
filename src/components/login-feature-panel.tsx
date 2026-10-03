// The side of the sign-in screen. Motion is CSS only, on transform and opacity.

const FEATURES = [
  {
    title: "Bulk notices",
    body: "Prepare a demand notice for every row in a bank spreadsheet, each with its own loan and amount.",
  },
  {
    title: "SMS, email, and WhatsApp",
    body: "Send the notice link by SMS, email, or WhatsApp from one place.",
  },
  {
    title: "Tracking",
    body: "See which messages were handed over, delivered, and opened, including the notice link.",
  },
  {
    title: "Many banks",
    body: "Keep each client bank separate. Firm staff switch banks. A bank viewer sees only their own.",
  },
] as const;

export function LoginFeaturePanel() {
  return (
    <aside className="bv-panel relative flex min-h-[28rem] overflow-hidden text-white lg:min-h-full">
      <div className="bv-orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="relative z-10 flex flex-col justify-center px-8 py-12 sm:px-12">
        <p className="text-xs font-medium tracking-[0.18em] text-white/75 uppercase">
          Why Notice Desk
        </p>
        <h2 className="mt-3 max-w-md font-serif text-4xl leading-tight tracking-tight">
          One desk for the firm’s bank notices
        </h2>
        <p className="mt-4 max-w-md text-base leading-7 text-white/80">
          Being Vakil Associates sends formal demand notices for lending banks. Notice Desk is the
          workspace behind that work.
        </p>
        <ol className="mt-8 flex max-w-md flex-col gap-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.title} className="bv-feature rounded-xl px-4 py-3">
              <p className="text-sm font-semibold tracking-wide text-white/70">
                0{index + 1}
              </p>
              <p className="mt-1 font-medium">{feature.title}</p>
              <p className="mt-1 text-sm leading-6 text-white/80">{feature.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
