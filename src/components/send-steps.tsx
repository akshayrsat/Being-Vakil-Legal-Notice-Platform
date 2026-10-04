import { SEND_STEPS, type SendStepNumber } from "@/lib/send-notice";

export function SendSteps({ current }: { current: SendStepNumber }) {
  return (
    <ol aria-label="How to send a notice" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {SEND_STEPS.map((step) => {
        const currentStep = step.number === current;
        return (
          <li
            key={step.number}
            aria-current={currentStep ? "step" : undefined}
            className={`rounded-xl px-3 py-3 ring-1 ${
              currentStep ? "bg-card ring-primary" : "bg-card ring-foreground/10"
            }`}
          >
            <p className="text-sm font-medium">
              {step.number}. {step.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
