import { Check } from "lucide-react";

export function CheckoutStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      {steps.map((step, i) => (
        <div key={step} className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                i <= current
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < current ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span className={`text-xs ${i <= current ? "font-semibold" : "text-muted-foreground"}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
