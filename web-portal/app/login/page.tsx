'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/auth';
import { LOGO_PATH } from '@/lib/brand';

function VerifiedNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('verified') !== '1') return null;
  return (
    <div
      role="status"
      className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
    >
      Email verified. You can sign in now.
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notVerified, setNotVerified] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotVerified(false);

    try {
      await authService.login({ email, organizationCode: organizationCode.trim().toUpperCase(), password });
      router.push('/dashboard');
    } catch (err: unknown) {
      let message = 'Login failed';
      if (err && typeof err === 'object' && 'response' in err) {
        const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
        if (data?.error === 'EMAIL_NOT_VERIFIED') {
          setNotVerified(true);
          return;
        }
        if (data?.message) message = data.message;
        else if (data?.error) message = data.error;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit} aria-label="Sign in">
      <Suspense fallback={null}>
        <VerifiedNotice />
      </Suspense>
      {notVerified && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p>Please verify your email before signing in.</p>
          <p className="mt-2">
            <Link
              href="/resend-verification"
              className="font-semibold text-navy-800 underline decoration-accent-400 decoration-2 underline-offset-4"
            >
              Resend verification email
            </Link>
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-navy-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1.5 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-4 py-2.5 text-navy-900 shadow-sm transition-shadow placeholder:text-navy-300 focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="organizationCode" className="block text-sm font-medium text-navy-800">
          Organisation code
        </label>
        <input
          id="organizationCode"
          name="organizationCode"
          type="text"
          autoComplete="organization"
          required
          className="mt-1.5 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-4 py-2.5 uppercase text-navy-900 shadow-sm transition-shadow placeholder:text-navy-300 focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-0"
          value={organizationCode}
          onChange={(e) => setOrganizationCode(e.target.value)}
          placeholder="e.g. HFL"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-navy-800">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="block w-full rounded-xl border border-navy-200 bg-navy-50/30 py-2.5 pl-4 pr-12 text-navy-900 shadow-sm transition-shadow placeholder:text-navy-300 focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-0"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-navy-600 transition-colors hover:bg-navy-100 hover:text-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full cursor-pointer rounded-xl bg-navy-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-navy-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-800 px-4 py-12 sm:px-6 sm:py-16">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-accent-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-navy-600/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-300/10 blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center">
        <h1 className="sr-only">Sign in to Haven Check</h1>

        <div className="mb-8 w-full px-2 sm:mb-10">
          <Image
            src={LOGO_PATH}
            alt="Haven Check"
            width={1000}
            height={480}
            priority
            className="mx-auto h-auto w-full max-w-md object-contain drop-shadow-[0_12px_24px_rgba(12,28,56,0.35)]"
          />
        </div>

        <div className="w-full rounded-3xl border border-white/20 bg-white p-8 shadow-2xl shadow-navy-900/25 ring-1 ring-accent-100/80 sm:p-10">
          <div
            className="-mx-8 -mt-8 mb-8 h-1.5 rounded-t-3xl bg-gradient-to-r from-navy-600 via-accent-400 to-navy-600 sm:-mx-10 sm:-mt-10"
            aria-hidden
          />
          <p className="-mt-2 text-center text-sm text-navy-700">
            Sign in to manage visits, schedules, and your team.
          </p>

          <Suspense fallback={<div className="mt-8 h-10" aria-hidden />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-sm text-navy-700">
            New here?{' '}
            <Link
              href="/signup"
              className="font-semibold text-navy-800 underline decoration-accent-400 decoration-2 underline-offset-4 transition-colors hover:text-navy-600"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-navy-700">
            Need to register a new organisation?{' '}
            <Link
              href="/create-organization"
              className="font-semibold text-navy-800 underline decoration-accent-400 decoration-2 underline-offset-4 transition-colors hover:text-navy-600"
            >
              Create organisation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
