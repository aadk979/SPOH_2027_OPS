import { Card, Kicker, PageHeader } from '../components/ui';

/** Placeholder for screens built in later slices, so navigation is complete from day one. */
export function ComingSoonPage({ title, slice }: { title: string; slice: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <Card>
        <Kicker>Coming in slice {slice}</Kicker>
        <p className="mt-1 text-sm text-ink-2">
          This screen is part of the build plan and will appear here when that slice ships.
        </p>
      </Card>
    </div>
  );
}
