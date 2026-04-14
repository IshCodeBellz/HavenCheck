'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';
import { LOGO_PATH } from '@/lib/brand';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const meetsLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isStrong = meetsLength && hasLetter && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (companyName.trim().length < 2) {
      setError('Company name must be at least 2 characters');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.register({
        name,
        companyName: companyName.trim(),
        organizationCode: organizationCode.trim().toUpperCase(),
        email,
        password,
      });
      if (result.requiresApproval) {
        setSuccess(result.message ?? 'Request submitted. Wait for admin approval before logging in.');
        setTimeout(() => router.push('/login'), 1200);
      } else if (result.requiresEmailVerification) {
        setSuccess(result.message ?? 'Check your email to verify your address, then sign in.');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      let message = 'Sign up failed';
      if (err && typeof err === 'object' && 'response' in err) {
        const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
        if (data?.message) message = data.message;
        else if (data?.error) message = data.error;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-800 px-4 py-10 sm:px-6 sm:py-14">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-accent-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-navy-600/35 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center">
        <div className="mb-6 w-full px-2 sm:mb-8">
          <Link href="/login" className="block outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-4 focus-visible:ring-offset-navy-800 rounded-lg">
            <Image
              src={LOGO_PATH}
              alt="Haven Check — back to sign in"
              width={1000}
              height={480}
              className="mx-auto h-auto w-full max-w-sm object-contain drop-shadow-[0_12px_24px_rgba(12,28,56,0.35)]"
            />
          </Link>
        </div>

        <div className="w-full rounded-3xl border border-white/20 bg-white p-8 shadow-2xl shadow-navy-900/25 ring-1 ring-accent-100/80 sm:p-10">
          <div
            className="-mx-8 -mt-8 mb-6 h-1.5 rounded-t-3xl bg-gradient-to-r from-navy-600 via-accent-400 to-navy-600 sm:-mx-10 sm:-mt-10"
            aria-hidden
          />
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Create your account</h1>
          <p className="mt-2 text-sm text-navy-700">
            Join an existing organisation using the exact name and organisation code.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} aria-label="Sign up">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              >
                {success}
              </div>
            )}

            <div>
            <label htmlFor="name" className="block text-sm font-medium text-navy-800">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="mt-1 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              className="mt-1 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-navy-800">
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              autoComplete="organization"
              required
              className="mt-1 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
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
              className="mt-1 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 uppercase text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
              value={organizationCode}
              onChange={(e) => setOrganizationCode(e.target.value)}
              placeholder="e.g. HFL"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy-800">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                className="block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 pr-11 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-navy-700 hover:bg-navy-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" />
                    <path d="M9.9 5.1A10.7 10.7 0 0112 5c5.2 0 9.3 5.8 9.5 6 .1.2-1.3 2.2-3.7 3.9" />
                    <path d="M6.6 6.7C4.1 8.4 2.6 10.8 2.5 11c-.1.2 4.3 6 9.5 6 1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                    <path d="M2.5 12s4.1-7 9.5-7 9.5 7 9.5 7-4.1 7-9.5 7-9.5-7-9.5-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className={`mt-2 text-xs ${isStrong ? 'text-green-700' : 'text-navy-700'}`}>
              Use at least 8 characters, including letters and numbers.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-navy-800">
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                className="block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 pr-11 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-navy-700 hover:bg-navy-50"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" />
                    <path d="M9.9 5.1A10.7 10.7 0 0112 5c5.2 0 9.3 5.8 9.5 6 .1.2-1.3 2.2-3.7 3.9" />
                    <path d="M6.6 6.7C4.1 8.4 2.6 10.8 2.5 11c-.1.2 4.3 6 9.5 6 1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                    <path d="M2.5 12s4.1-7 9.5-7 9.5 7 9.5 7-4.1 7-9.5 7-9.5-7-9.5-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="mt-2 text-xs text-red-700">Passwords do not match.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full cursor-pointer rounded-xl bg-navy-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-navy-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-sm text-navy-700">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-navy-800 underline decoration-accent-400 decoration-2 underline-offset-4 transition-colors hover:text-navy-600"
          >
            Log in
          </Link>
        </p>
        <p className="mt-2 text-sm text-navy-700">
          Need to set up a new organisation first?{' '}
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
