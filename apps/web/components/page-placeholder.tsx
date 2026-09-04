import { Badge, Card } from "@pl/ui";

export function PagePlaceholder({
  title,
  description,
  milestone,
}: {
  title: string;
  description: string;
  milestone: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>{milestone}</Badge>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="max-w-2xl text-sm text-slate-400">{description}</p>
      </div>
      <Card>
        <p className="text-sm text-slate-400">
          This surface is scaffolded but not wired to data yet — it is intentionally empty rather
          than showing fabricated markets or balances.
        </p>
      </Card>
    </div>
  );
}
