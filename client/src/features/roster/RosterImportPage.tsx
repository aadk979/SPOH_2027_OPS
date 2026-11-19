import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { Button, Card, CountChip, Kicker, Notice, PageHeader } from '../../components/ui';
import { useCommitRoster, useDeactivate, downloadTemplate, usePreviewRoster } from './rosterApi';

/** UC-17 (CC only): template → upload → preview with row errors → commit all-or-nothing. */
export function RosterImportPage() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const preview = usePreviewRoster();
  const commit = useCommitRoster();
  const deactivate = useDeactivate();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    commit.reset();
    preview.mutate(text);
  };

  const p = preview.data;
  const canCommit = Boolean(csv && p && p.summary.errors === 0 && !commit.isSuccess);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Import roster"
        subtitle="Nothing is saved until the whole file is valid and you confirm."
        actions={
          <Link to="/people">
            <Button variant="secondary">Back to People</Button>
          </Link>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void downloadTemplate()}>
          ⬇ Download template
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-btn bg-accent px-4 py-2.5 text-sm font-bold text-on-accent">
          ⬆ Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e)}
          />
        </label>
        {fileName && <span className="font-mono text-xs text-muted">{fileName}</span>}
        <p className="w-full text-xs text-muted">
          The template's day columns always match the event days in Setup.
        </p>
      </Card>

      {preview.isPending && <p className="text-sm text-muted">Checking the file…</p>}
      {preview.error && <Notice tone="error">{preview.error.message}</Notice>}

      {p && (
        <>
          <div className="flex flex-wrap gap-2">
            <CountChip tone="ok" count={p.summary.new} one="new" many="new" />
            <CountChip tone="info" count={p.summary.updated} one="updated" many="updated" />
            <CountChip count={p.summary.unchanged} one="unchanged" many="unchanged" />
            {p.summary.errors > 0 && (
              <CountChip tone="error" count={p.summary.errors} one="error" />
            )}
          </div>

          {p.errors.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Column</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {p.errors.map((e, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 font-mono">{e.row || '—'}</td>
                      <td className="px-3 py-2 font-mono">{e.column || '—'}</td>
                      <td className="px-3 py-2">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {p.summary.errors > 0 && (
            <Notice tone="error">Fix these rows and upload again. Nothing has been saved.</Notice>
          )}

          {canCommit && (
            <Button
              className="self-start"
              disabled={commit.isPending}
              onClick={() => csv && commit.mutate(csv)}
            >
              {commit.isPending
                ? 'Importing…'
                : `Import ${p.summary.new + p.summary.updated} changes`}
            </Button>
          )}
          {commit.error && <Notice tone="error">{commit.error.message}</Notice>}
          {commit.data && (
            <Notice tone="ok">
              Imported: {commit.data.created} new, {commit.data.updated} updated,{' '}
              {commit.data.unchanged} unchanged.
            </Notice>
          )}

          {p.missing.length > 0 && (
            <Card className="flex flex-col gap-2">
              <Kicker>Not in this file ({p.missing.length}) · kept, not deleted</Kicker>
              <ul className="text-sm">
                {p.missing.map((m) => (
                  <li key={m.id}>
                    {m.name} <span className="text-muted">· {m.email}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="danger"
                className="self-start"
                disabled={deactivate.isPending || deactivate.isSuccess}
                onClick={() => deactivate.mutate(p.missing.map((m) => m.id))}
              >
                {deactivate.isSuccess
                  ? `Deactivated ${deactivate.data.deactivated}`
                  : 'Deactivate these people'}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
