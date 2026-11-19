import clsx from 'clsx';
import { NavLink, Outlet } from 'react-router';
import { RANK_LABELS } from '@spoh/shared';
import { BrandMark, Button } from '../components/ui';
import { useAuth } from '../features/auth/AuthProvider';
import { useTheme } from '../lib/theme';
import { navFor, phoneNavFor, type NavItem } from './nav';

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'rounded-btn px-3 py-2 text-sm font-medium',
          isActive ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:bg-surface',
        )
      }
    >
      {item.label}
    </NavLink>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold',
          isActive ? 'text-accent' : 'text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={clsx(
              'h-[18px] w-[18px] rounded-[5px] border-[1.7px] border-current',
              isActive && 'bg-accent/20',
            )}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

/**
 * Signed-in layout: side menu on laptops, bottom tab bar on phones (wireframes §C).
 * Menu items come from nav.ts, filtered by the user's tier.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  if (!user) return null;
  const side = navFor(user);
  const { bar } = phoneNavFor(user);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-2/60 p-3 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-2 pt-1 font-display text-sm font-bold">
          <BrandMark /> SPOH 2027 Ops
        </div>
        {side.map((item) => (
          <SideLink key={item.to} item={item} />
        ))}
        <div className="mt-auto flex flex-col gap-2 border-t border-line px-2 pt-3 text-xs text-muted">
          <span>
            {user.name} · {RANK_LABELS[user.rank]}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 px-2 py-1.5 text-xs"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1 px-2 py-1.5 text-xs"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <div className="flex items-center gap-2 font-display text-sm font-bold">
            <BrandMark /> SPOH 2027
          </div>
          <span className="rounded-full border border-line px-2 py-1 font-mono text-[11px] text-muted">
            {RANK_LABELS[user.rank]}
          </span>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {bar.map((item) => (
            <TabLink key={item.to} to={item.to} label={item.label} />
          ))}
          <TabLink to="/more" label="More" />
        </nav>
      </div>
    </div>
  );
}
