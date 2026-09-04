import { Badge, Card, Section } from "@pl/ui";

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Badge>Reference</Badge>
        <h1 className="text-2xl font-bold text-white">Docs</h1>
      </div>

      <Section title="Specification documents (repo root)">
        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          {[
            "01_PRODUCT_SPEC.md",
            "02_TECHNICAL_ARCHITECTURE.md",
            "03_SMART_CONTRACT_SPEC.md",
            "04_API_DATABASE_SPEC.md",
            "05_UI_UX_SPEC.md",
            "06_SECURITY_COMPLIANCE.md",
            "07_TESTING_AND_ACCEPTANCE.md",
            "08_ROADMAP.md",
            "CODEX_MASTER_PROMPT.md",
          ].map((file) => (
            <Card key={file} className="px-4 py-2.5 font-mono text-xs">
              {file}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Operational docs (docs/)">
        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["docs/architecture.md", "Architecture"],
            ["docs/contracts.md", "Contracts"],
            ["docs/api.md", "API"],
            ["docs/database.md", "Database"],
            ["docs/oracles.md", "Oracles"],
            ["docs/swap-flow.md", "Swap flow"],
            ["docs/security.md", "Security"],
            ["docs/deployment.md", "Deployment"],
            ["docs/runbook.md", "Runbook"],
          ].map(([file, label]) => (
            <Card key={file} className="space-y-0.5">
              <p className="text-sm text-white">{label}</p>
              <p className="font-mono text-xs text-slate-500">{file}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Official sources">
        <a
          href="https://docs.robinhood.com/chain/"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          docs.robinhood.com/chain ↗
        </a>
      </Section>
    </div>
  );
}
