import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import type { MessageResponse, VerifyCodeResponse } from '@spoh/shared';
import { BrandMark, Button, Card, Notice, TextField } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';

/** Reads `#email=…&code=…` from a magic link, then clears it from the address bar. */
function readMagicLink(): { email: string; code: string } | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const email = params.get('email');
  const code = params.get('code');
  if (!email || !code) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return { email, code };
}

/** UC-01: email → 6-digit code → signed in. Magic links sign in automatically. */
export function LoginPage() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  const requestCode = useMutation({
    mutationFn: (address: string) =>
      api<MessageResponse>('/auth/request', {
        method: 'POST',
        body: JSON.stringify({ email: address }),
      }),
    onSuccess: () => setStep('code'),
  });
  const verify = useMutation({
    mutationFn: (body: { email: string; code: string }) =>
      api<VerifyCodeResponse>('/auth/verify', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: signIn,
  });

  // Magic links: handle on first load *and* when the link is opened in a tab that is
  // already on /login (then only the #fragment changes and the page doesn't reload).
  const { mutate: verifyCode } = verify;
  useEffect(() => {
    const handle = () => {
      const link = readMagicLink();
      if (!link) return;
      setEmail(link.email);
      setCode(link.code);
      setStep('code');
      verifyCode(link);
    };
    handle();
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, [verifyCode]);

  if (user) return <Navigate to="/" replace />;

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    requestCode.mutate(email);
  };
  const onCode = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate({ email, code });
  };
  const errorOf = (err: unknown) => (err instanceof ApiError ? err.message : null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2 font-display text-sm font-bold">
        <BrandMark /> SPOH 2027
      </div>
      <Card className="flex flex-col gap-4 px-5 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Use your SP iChat email. We'll send you a 6-digit code.
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={onEmail} className="flex flex-col gap-3" noValidate>
            <TextField
              label="iChat email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name.25@ichat.sp.edu.sg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errorOf(requestCode.error) ?? undefined}
              required
            />
            <Button type="submit" block disabled={!email || requestCode.isPending}>
              {requestCode.isPending ? 'Sending…' : 'Send me a code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={onCode} className="flex flex-col gap-3" noValidate>
            {requestCode.data && <Notice tone="ok">{requestCode.data.message}</Notice>}
            <TextField
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center font-mono text-lg tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              error={errorOf(verify.error) ?? undefined}
              autoFocus
            />
            <Button type="submit" block disabled={code.length !== 6 || verify.isPending}>
              {verify.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('email')}>
              Use a different email
            </Button>
          </form>
        )}
      </Card>
      <p className="text-center text-xs text-muted">No email? Ask your Deputy for a code.</p>
    </main>
  );
}
