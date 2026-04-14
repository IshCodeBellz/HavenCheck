'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type ClientOption = { id: string; name: string };

export default function NewOpenShiftPage() {
  const staffOk = useRequireStaff();
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    slotsNeeded: 5,
    title: '',
    startTime: '',
    endTime: '',
  });

  const loadClients = useCallback(async () => {
    try {
      const res = await apiV1.get<ClientOption[]>('/manager/clients');
      setClients(res.data);
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    if (staffOk) loadClients();
  }, [staffOk, loadClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        clientId: form.clientId,
        slotsNeeded: Number(form.slotsNeeded),
        title: form.title.trim() || undefined,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      };
      const res = await apiV1.post('/manager/shift-postings', payload);
      router.push(`/manager/open-shifts/${res.data.id}`);
    } catch (err: unknown) {
      const d =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : undefined;
      setError(d?.message || 'Could not create shift posting');
    } finally {
      setLoading(false);
    }
  };

  if (staffOk === null || staffOk === false) {
    return (
      <Layout>
        <p role="status" className="text-navy-800">
          {staffOk === false ? 'Redirecting…' : 'Checking access…'}
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg">
        <Link href="/manager/open-shifts" className="text-sm text-navy-600 hover:underline mb-4 inline-block">
          ← Open shifts
        </Link>
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Post an open shift</h1>
        <p className="text-sm text-navy-800/70 mb-6">
          Set how many carers you need. Team members can apply; you assign slots from the applicant list.
        </p>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Client</label>
            <select
              required
              className="w-full rounded-lg border border-navy-200 px-3 py-2 text-navy-900"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Carers needed (slots)</label>
            <input
              type="number"
              min={1}
              max={99}
              required
              className="w-full rounded-lg border border-navy-200 px-3 py-2 text-navy-900"
              value={form.slotsNeeded}
              onChange={(e) => setForm((f) => ({ ...f, slotsNeeded: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Title (optional)</label>
            <input
              type="text"
              className="w-full rounded-lg border border-navy-200 px-3 py-2 text-navy-900"
              placeholder="e.g. Night cover — Willow Lodge"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Start</label>
            <input
              type="datetime-local"
              required
              className="w-full rounded-lg border border-navy-200 px-3 py-2 text-navy-900"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">End</label>
            <input
              type="datetime-local"
              required
              className="w-full rounded-lg border border-navy-200 px-3 py-2 text-navy-900"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Post shift'}
            </button>
            <Link
              href="/manager/open-shifts"
              className="rounded-xl border border-navy-200 px-4 py-2.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
