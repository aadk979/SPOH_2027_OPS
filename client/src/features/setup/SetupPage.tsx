import { useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '../../components/ui';
import { DaysSection } from './DaysSection';
import { StationsSection } from './StationsSection';
import { ThresholdsSection } from './ThresholdsSection';

const TABS = [
  { id: 'days', label: 'Days', Section: DaysSection },
  { id: 'stations', label: 'Stations', Section: StationsSection },
  { id: 'thresholds', label: 'Thresholds', Section: ThresholdsSection },
] as const;

/** Wireframe B4: event days, stations and thresholds. Admins only (FR-CFG-5/6). */
export function SetupPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('days');
  const { Section } = TABS.find((t) => t.id === tab)!;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Setup"
        subtitle="Nothing is hard-wired: change days and stations any time."
      />
      <div role="tablist" aria-label="Setup sections" className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold',
              tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Section />
    </div>
  );
}
