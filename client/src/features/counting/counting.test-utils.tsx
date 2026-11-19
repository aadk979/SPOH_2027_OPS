import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { installFakeCountingApi } from '../../test/fakeCountingApi';
import { footfallQueue } from './footfallApi';
import { registrationQueue } from './registrationApi';
import { CountPage } from './CountPage';

/** Renders /count with a fresh query cache against the fake counting API. */
export function renderCountPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CountPage />
    </QueryClientProvider>,
  );
}

/** Installs the fake API before each test and empties the shared tap queues after. */
export function useFakeCountingApi() {
  const ref: { api: ReturnType<typeof installFakeCountingApi> } = {} as never;
  beforeEach(() => {
    ref.api = installFakeCountingApi();
  });
  afterEach(() => {
    for (const q of [registrationQueue, footfallQueue]) {
      q.cancelAll();
      q.clearLastSaved();
    }
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  return ref;
}
