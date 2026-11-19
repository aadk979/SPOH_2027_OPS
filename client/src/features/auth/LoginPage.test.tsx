import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './LoginPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('requests a code, then verifies it and stores the session token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { message: "If you're on the roster, a code is on its way." }),
      )
      .mockResolvedValueOnce(
        json(200, {
          token: 'tok-123',
          expiresAt: '2027-01-07T15:59:59.999Z',
          user: {
            id: 'u1',
            name: 'Alex',
            email: 'a@x.sg',
            rank: 'volunteer',
            tier: 'volunteer',
            team: 'Relief',
            portfolio: null,
            course: null,
            canManageBreaks: false,
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderLogin();

    await userEvent.type(screen.getByLabelText('iChat email'), 'a@x.sg');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    expect(await screen.findByText(/a code is on its way/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('6-digit code'), '12a3456');
    expect(screen.getByLabelText('6-digit code')).toHaveValue('123456'); // digits only
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await vi.waitFor(() => expect(localStorage.getItem('spoh.token')).toBe('tok-123'));
    const [, verifyInit] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(verifyInit.body)).toEqual({ email: 'a@x.sg', code: '123456' });
  });

  it('shows the server error for a wrong code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { message: 'sent' }))
        .mockResolvedValueOnce(
          json(401, {
            error: { code: 'INVALID_CODE', message: 'That code is wrong or has expired.' },
          }),
        ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('iChat email'), 'a@x.sg');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await userEvent.type(await screen.findByLabelText('6-digit code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('That code is wrong or has expired.')).toBeInTheDocument();
  });
});
