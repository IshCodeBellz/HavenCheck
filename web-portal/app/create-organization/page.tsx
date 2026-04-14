'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const created = await authService.createOrganization({
        companyName: companyName.trim(),
        organizationCode: organizationCode.trim().toUpperCase(),
      });
      setSuccess(`Organisation ${created.name} (${created.code}) created. Now create the first account.`);
      setTimeout(() => router.push('/signup'), 1200);
    } catch (err: unknown) {
      let message = 'Organisation creation failed';
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
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-navy-900">Create organisation</h1>
      <p className="mt-2 text-sm text-navy-700">
        Step 1: create the organisation profile. Step 2: create the first user account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {success && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{success}</div>}

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-navy-800">Organisation name</label>
          <input
            id="companyName"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-navy-200 px-3 py-2.5"
          />
        </div>

        <div>
          <label htmlFor="organizationCode" className="block text-sm font-medium text-navy-800">Organisation code</label>
          <input
            id="organizationCode"
            required
            value={organizationCode}
            onChange={(e) => setOrganizationCode(e.target.value)}
            placeholder="e.g. HFL"
            className="mt-1 block w-full rounded-xl border border-navy-200 px-3 py-2.5 uppercase"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-navy-600 px-4 py-2.5 text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create organisation'}
        </button>
      </form>

      <p className="mt-4 text-sm text-navy-700">
        Already have an organisation?{' '}
        <Link href="/signup" className="font-semibold text-navy-800 underline decoration-accent-400 decoration-2 underline-offset-4">
          Create account
        </Link>
      </p>
    </div>
  );
}
