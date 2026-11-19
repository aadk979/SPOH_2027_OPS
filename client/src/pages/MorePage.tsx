import { Link } from 'react-router';
import { RANK_LABELS } from '@spoh/shared';
import { Button, Card, Kicker, PageHeader } from '../components/ui';
import { useAuth } from '../features/auth/AuthProvider';
import { phoneNavFor } from '../layout/nav';
import { useTheme } from '../lib/theme';

/** Phone "More" tab: remaining menu items, theme and sign-out. */
export function MorePage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  if (!user) return null;
  const { more } = phoneNavFor(user);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="More" subtitle={`${user.name} · ${RANK_LABELS[user.rank]}`} />
      {more.length > 0 && (
        <Card className="flex flex-col divide-y divide-line p-0">
          {more.map((item) => (
            <Link key={item.to} to={item.to} className="px-4 py-3 text-sm font-medium">
              {item.label}
            </Link>
          ))}
        </Card>
      )}
      <Card className="flex items-center justify-between">
        <div>
          <Kicker>Appearance</Kicker>
          <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </div>
        <Button variant="secondary" onClick={toggle}>
          Switch
        </Button>
      </Card>
      <Button variant="danger" block onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
