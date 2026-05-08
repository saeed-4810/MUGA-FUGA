import { cn } from "@/lib/utils";

interface WizardStep {
  description: string;
  id: string;
  label: string;
  state?: "active" | "complete" | "pending";
}

interface WizardStepsProps {
  label: string;
  steps: readonly WizardStep[];
}

export const WizardSteps = ({ label, steps }: WizardStepsProps) => (
  <ol aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {steps.map((step, index) => {
      const state = step.state ?? "pending";
      return (
        <li
          aria-current={state === "active" ? "step" : undefined}
          className={cn(
            "border-border bg-card rounded-2xl border p-4 text-sm shadow-sm",
            state === "active" && "border-primary/60 bg-primary/10",
            state === "complete" && "border-primary/40 bg-primary/10"
          )}
          key={step.id}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-full text-xs font-semibold">
              {index + 1}
            </span>
            <span className="text-foreground font-medium">{step.label}</span>
          </div>
          <p className="text-muted-foreground text-xs leading-5">{step.description}</p>
        </li>
      );
    })}
  </ol>
);
