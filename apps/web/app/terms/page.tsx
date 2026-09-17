import { Badge, Card, Section } from "@pl/ui";

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge>Draft · counsel review required</Badge>
        <h1 className="text-3xl font-bold text-white">Terms and eligibility</h1>
        <p className="max-w-3xl text-slate-400">
          This pre-launch summary explains intended controls. It is not the final legal agreement
          and does not enable mainnet participation.
        </p>
      </header>
      <Section title="Before participating">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Self-custody",
              "You authorize transactions from your wallet. The application does not hold your keys.",
            ],
            [
              "Eligibility",
              "Access may be limited by age, identity, sanctions, location, and counsel-approved rules.",
            ],
            [
              "Final settlement",
              "There is no early exit in v0. Terms and resolution sources are shown before entry.",
            ],
          ].map(([title, body]) => (
            <Card key={title}>
              <h2 className="font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
