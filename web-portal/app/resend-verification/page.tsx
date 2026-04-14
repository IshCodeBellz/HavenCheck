'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { authService } from '@/lib/auth';
import { LOGO_PATH } from '@/lib/brand';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { message: msg } = await authService.resendVerificationEmail(email);
      setMessage(msg);
    } catch (err: unknown) {
      let msg = 'Something went wrong';
      if (err && typeof err === 'object' && 'response' in err) {
        const d = (err as { response?: { data?: { message?: string } } }).response?.data;
        if (d?.message) msg = d.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-800 px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center">
        <div className="mb-6 w-full px-2">
          <Link href="/login" className="block outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-lg">
            <Image
              src={LOGO_PATH}
              alt="Haven Check — back to sign in"
              width={1000}
              height={480}
              className="mx-auto h-auto w-full max-w-sm object-contain"
            />
          </Link>
        </div>

        <div className="w-full rounded-3xl border border-white/20 bg-white p-8 shadow-2xl sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Resend verification email</h1>
          <p className="mt-2 text-sm text-navy-700">
            Enter the email you used to register. If the account is not verified yet, we will send a new link.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {message}
              </div>
            )}
            <div>
              <label htmlFor="resend-email" className="block text-sm font-medium text-navy-800">
                Email
              </label>
              <input
                id="resend-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-xl border border-navy-200 bg-navy-50/30 px-3 py-2.5 text-navy-900 shadow-sm focus:border-navy-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-navy-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send link'}
            </button>
          </form>

          <p className="mt-6 text-sm text-navy-700">
            <Link href="/login" className="font-semibold text-navy-800 underline decoration-accent-400 underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
