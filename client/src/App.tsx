import { Route, Routes } from 'react-router';
import { LoginPage } from './features/auth/LoginPage';
import { CountPage } from './features/counting/CountPage';
import { PeoplePage } from './features/people/PeoplePage';
import { RosterImportPage } from './features/roster/RosterImportPage';
import { AppShell } from './layout/AppShell';
import { HomeRedirect, RequireAuth, RequireTier } from './layout/guards';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { MorePage } from './pages/MorePage';

/** Route table. Placeholders show where later slices plug in (engineering/04_planning). */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="duty" element={<ComingSoonPage title="My Duty" slice="S3" />} />
        <Route path="count" element={<CountPage />} />
        <Route path="gifts" element={<ComingSoonPage title="Gifts" slice="S5" />} />
        <Route path="more" element={<MorePage />} />
        <Route
          path="team"
          element={
            <RequireTier tier="ic">
              <ComingSoonPage title="My team" slice="S3" />
            </RequireTier>
          }
        />
        <Route
          path="breaks"
          element={
            <RequireTier tier="ic">
              <ComingSoonPage title="Breaks" slice="S4" />
            </RequireTier>
          }
        />
        <Route
          path="dashboard"
          element={
            <RequireTier tier="admin">
              <ComingSoonPage title="Dashboard" slice="S5" />
            </RequireTier>
          }
        />
        <Route
          path="deployment"
          element={
            <RequireTier tier="admin">
              <ComingSoonPage title="Deployment" slice="S3" />
            </RequireTier>
          }
        />
        <Route
          path="setup"
          element={
            <RequireTier tier="admin">
              <ComingSoonPage title="Setup" slice="S3" />
            </RequireTier>
          }
        />
        <Route
          path="reports"
          element={
            <RequireTier tier="admin">
              <ComingSoonPage title="Reports" slice="S7" />
            </RequireTier>
          }
        />
        <Route
          path="people"
          element={
            <RequireTier tier="admin">
              <PeoplePage />
            </RequireTier>
          }
        />
        <Route
          path="people/import"
          element={
            <RequireTier tier="cc">
              <RosterImportPage />
            </RequireTier>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
