import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-btn border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted ' +
  'focus:border-ink focus:outline-none disabled:opacity-60';

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint/error, wired up for screen readers. */
function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      {children(id, error || hint ? noteId : undefined)}
      {(error || hint) && (
        <p id={noteId} className={clsx('text-xs', error ? 'text-busy' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={clsx(CONTROL, error && 'border-busy', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | undefined;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  options,
  placeholder,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error}>
      {(id, describedBy) => (
        <select
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={clsx(CONTROL, error && 'border-busy', className)}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
