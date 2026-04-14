'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/auth';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('err');
      setMessage('Missing verification token.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await authService.verifyEmail(token);
        if (!cancelled) {
          setStatus('ok');
          setMessage('Your email is verified. Redirecting to sign in…');
          setTimeout(() => router.replace('/login?verified=1'), 1500);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus('err');
        let msg = 'Verification failed.';
        if (e && typeof e === 'object' && 'response' in e) {
          const d = (e as { response?: { data?: { message?: string } } }).response?.data;
          if (d?.message) msg = d.message;
        }
        setMessage(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-navy-800 px-4 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-navy-900/40 p-8 shadow-xl">
        <h1 className="text-xl font-semibold">Email verification</h1>
        {status === 'loading' && <p className="mt-4 text-sm text-white/80">Verifying your link…</p>}
        {status === 'ok' && (
          <p className="mt-4 text-sm text-green-200" role="status">
            {message}
          </p>
        )}
        {status === 'err' && (
          <p className="mt-4 text-sm text-red-200" role="alert">
            {message}
          </p>
        )}
        <p className="mt-6 text-sm text-white/70">
          <Link href="/resend-verification" className="font-medium text-accent-300 underline underline-offset-2">
            Request a new link
          </Link>
          {' · '}
          <Link href="/login" className="font-medium text-accent-300 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-800 px-4 py-16 text-white">
          <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-navy-900/40 p-8">
            <p className="text-sm text-white/80">Loading…</p>
          </div>
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
