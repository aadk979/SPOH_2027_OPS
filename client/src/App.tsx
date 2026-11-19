import { Route, Routes } from 'react-router';
import { FoundationPage } from './pages/FoundationPage';

/** Route table. Feature pages are added per build slice (see engineering/04_planning). */
export function App() {
  return (
    <Routes>
      <Route path="*" element={<FoundationPage />} />
    </Routes>
  );
}
