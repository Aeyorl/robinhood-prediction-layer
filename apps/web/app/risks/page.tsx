import { Badge, Card, Section } from "@pl/ui";

const risks = [
  [
    "Loss of capital",
    "A wrong position can lose the full amount committed, including fees and network costs.",
  ],
  [
    "Oracle and network risk",
    "Feeds, sequencers, RPC providers, and Robinhood Chain can be delayed or unavailable.",
  ],
  [
    "Smart-contract risk",
    "Code defects, token behavior, or integration failures may lock or lose assets despite testing.",
  ],
  [
    "Liquidity and finality",
    "v0 positions cannot exit early. Resolution follows the disclosed market schedule.",
  ],
  [
    "Regulatory risk",
    "Rules may change or prohibit access based on person, location, market type, or operator duties.",
  ],
  [
    "Wallet responsibility",
    "Compromised keys, malicious approvals, phishing, and signing mistakes can cause irreversible loss.",
  ],
];

export default function RisksPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge>Read before entering</Badge>
        <h1 className="text-3xl font-bold text-white">Risk disclosure</h1>
        <p className="max-w-3xl text-slate-400">
          Prediction markets are speculative. Review the terms, source, deadline, fees, and maximum
          loss before signing.
        </p>
      </header>
      <Section title="Material risks">
        <div className="grid gap-4 md:grid-cols-2">
          {risks.map(([title, body], index) => (
            <Card key={title}>
              <span className="font-mono text-xs text-indigo-300">0{index + 1}</span>
              <h2 className="mt-2 font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </Card>
          ))}
        </div>
      </Section>
      <p className="text-xs text-slate-500">
        Draft disclosure · final wording requires qualified counsel approval.
      </p>
    </div>
  );
}
