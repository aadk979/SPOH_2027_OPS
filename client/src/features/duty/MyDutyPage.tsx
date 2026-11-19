import { useState } from 'react';
import { formatDayShort, type DutyDay } from '@spoh/shared';
import { Card, DayTabs, Kicker, Notice, PageHeader } from '../../components/ui';
import { useMyDuty } from './dutyApi';
import { PendingBanner } from './PendingBanner';

function Post({ day, team }: { day: DutyDay; team: string | null }) {
  if (!day.station) {
    return (
      <Card>
        <Kicker>{day.available ? 'Not posted yet' : 'Not rostered'}</Kicker>
        <p className="mt-1 text-sm text-ink-2">
          {day.available
            ? 'Your Deputy has not given you a station for this day yet.'
            : 'You are not rostered on this day.'}
        </p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-1">
      <Kicker>Station</Kicker>
      <div className="font-display text-2xl font-bold" data-testid="duty-station">
        {day.station.name}
      </div>
      <div className="text-sm text-muted">
        {[day.station.room || null, team].filter(Boolean).join(' · ')}
      </div>
      {day.later.map((l) => (
        <div key={l.from} className="mt-1 text-sm font-semibold">
          From {l.from} → {l.station.name}
          {l.station.room && <span className="font-normal text-muted"> · {l.station.room}</span>}
        </div>
      ))}
    </Card>
  );
}

/** Wireframe A2: today's duty at a glance, any change to acknowledge on top (FR-DUTY-5). */
export function MyDutyPage() {
  const duty = useMyDuty();
  const [chosen, setChosen] = useState<string | null>(null);
  const data = duty.data;
  const dayId = chosen ?? data?.defaultDayId ?? null;
  const day = data?.days.find((d) => d.day.id === dayId);
  const notRostered = data?.days.filter((d) => !d.available) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My Duty"
        subtitle={
          day
            ? `${formatDayShort(day.day.date)}${day.day.label ? ` · ${day.day.label}` : ''}`
            : undefined
        }
      />
      {duty.error && <Notice tone="error">{duty.error.message}</Notice>}
      {duty.isPending && <p className="text-sm text-muted">Loading…</p>}
      {data && <PendingBanner pending={data.pending} />}
      {data && data.days.length > 1 && (
        <DayTabs
          days={data.days.map((d) => d.day)}
          value={dayId}
          onChange={setChosen}
          todayId={data.todayDayId}
        />
      )}
      {data?.days.length === 0 && <Notice>No event days are set up yet.</Notice>}
      {day && data && (
        <>
          <Post day={day} team={data.team} />
          <div className="grid grid-cols-2 gap-2.5">
            <Card>
              <Kicker>Your IC</Kicker>
              <div className="font-semibold">{data.icNames.join(', ') || '—'}</div>
            </Card>
            <Card>
              <Kicker>Team</Kicker>
              <div className="font-semibold">{data.team ?? '—'}</div>
            </Card>
            <Card>
              <Kicker>Report</Kicker>
              <div className="font-mono text-lg font-bold">{day.day.reportTime ?? 'TBC'}</div>
            </Card>
            <Card>
              <Kicker>Dismiss</Kicker>
              <div className="font-mono text-lg font-bold">{day.day.dismissTime ?? 'TBC'}</div>
            </Card>
          </div>
          <Card>
            <Kicker>Breaks</Kicker>
            {day.breaks.length === 0 ? (
              <p className="text-sm text-muted">No break set yet.</p>
            ) : (
              day.breaks.map((b) => (
                <div key={b.start} className="font-semibold">
                  {b.label ?? 'Break'}{' '}
                  <span className="font-mono">
                    {b.start}–{b.end}
                  </span>
                </div>
              ))
            )}
          </Card>
        </>
      )}
      {notRostered.length > 0 && (
        <p className="text-sm text-muted">
          Not rostered: {notRostered.map((d) => formatDayShort(d.day.date)).join(', ')}
        </p>
      )}
    </div>
  );
}
