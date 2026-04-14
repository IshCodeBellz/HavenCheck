'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type Application = {
  id: string;
  status: string;
  carer: { id: string; name: string; email: string };
};

type ShiftPostingDetail = {
  id: string;
  title: string | null;
  status: string;
  slotsNeeded: number;
  startTime: string;
  endTime: string;
  client: { id: string; name: string; address: string };
  applications: Application[];
};

export default function OpenShiftDetailPage() {
  const staffOk = useRequireStaff();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [posting, setPosting] = useState<ShiftPostingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<ShiftPostingDetail>(`/manager/shift-postings/${id}`);
      setPosting(res.data);
      setSelectedIds(new Set());
    } catch {
      setPosting(null);
      setError('Could not load this shift posting.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (staffOk && id) load();
  }, [staffOk, id, load]);

  const selectedCount = useMemo(
    () => posting?.applications.filter((a) => a.status === 'SELECTED').length ?? 0,
    [posting]
  );
  const remainingSlots = posting ? Math.max(0, posting.slotsNeeded - selectedCount) : 0;
  const pending = useMemo(() => posting?.applications.filter((a) => a.status === 'PENDING') ?? [], [posting]);

  const toggle = (applicationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
        return next;
      }
      if (next.size >= remainingSlots) return prev;
      next.add(applicationId);
      return next;
    });
  };

  const assignSelected = async () => {
    if (!posting || selectedIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiV1.post(`/manager/shift-postings/${posting.id}/select`, {
        applicationIds: Array.from(selectedIds),
      });
      await load();
    } catch (err: unknown) {
      const d =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : undefined;
      setError(d?.message || 'Assignment failed (check carer availability).');
    } finally {
      setSaving(false);
    }
  };

  const cancelPosting = async () => {
    if (!posting || posting.status !== 'OPEN') return;
    if (!window.confirm('Cancel this posting? Pending applicants will be marked not selected.')) return;
    setSaving(true);
    setError(null);
    try {
      await apiV1.post(`/manager/shift-postings/${posting.id}/cancel`);
      router.push('/manager/open-shifts');
    } catch {
      setError('Could not cancel posting.');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <Layout>
        <p className="text-navy-800">Loading…</p>
      </Layout>
    );
  }

  if (!posting) {
    return (
      <Layout>
        <p className="text-red-700">{error || 'Not found.'}</p>
        <Link href="/manager/open-shifts" className="text-navy-600 text-sm mt-4 inline-block hover:underline">
          ← Back
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <Link href="/manager/open-shifts" className="text-sm text-navy-600 hover:underline mb-4 inline-block">
        ← Open shifts
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{posting.client.name}</h1>
          {posting.title && <p className="text-navy-800/80 mt-1">{posting.title}</p>}
          <p className="text-sm text-navy-800/70 mt-2">
            {format(new Date(posting.startTime), 'MMM d, yyyy HH:mm')} – {format(new Date(posting.endTime), 'HH:mm')}
          </p>
          <p className="text-sm mt-2">
            <span className="font-medium text-navy-900">{selectedCount}</span> / {posting.slotsNeeded} slots filled ·
            Status: <span className="text-navy-700">{posting.status}</span>
          </p>
        </div>
        {posting.status === 'OPEN' && (
          <button
            type="button"
            onClick={cancelPosting}
            disabled={saving}
            className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Cancel posting
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-navy-100 bg-navy-50/50">
          <h2 className="font-semibold text-navy-900">Applicants</h2>
          <p className="text-xs text-navy-800/70 mt-1">
            {posting.status === 'OPEN' && remainingSlots > 0
              ? `Select up to ${remainingSlots} pending applicant(s), then assign. Schedules and visits are created for chosen carers.`
              : posting.status === 'OPEN'
                ? 'All slots are filled; remaining pending applicants were marked not selected when the posting filled.'
                : 'This posting is closed.'}
          </p>
        </div>

        <ul className="divide-y divide-navy-100">
          {posting.applications.length === 0 ? (
            <li className="px-4 py-6 text-center text-navy-800/70 text-sm">No applications yet.</li>
          ) : (
            posting.applications.map((app) => (
              <li key={app.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                {app.status === 'PENDING' && posting.status === 'OPEN' && remainingSlots > 0 ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-navy-300 text-navy-900"
                    checked={selectedIds.has(app.id)}
                    onChange={() => toggle(app.id)}
                    aria-label={`Select ${app.carer.name}`}
                  />
                ) : (
                  <span className="w-4" aria-hidden />
                )}
                <div className="flex-1 min-w-48">
                  <div className="font-medium text-navy-900">{app.carer.name}</div>
                  <div className="text-xs text-navy-800/70">{app.carer.email}</div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    app.status === 'PENDING'
                      ? 'bg-sky-50 text-sky-800'
                      : app.status === 'SELECTED'
                        ? 'bg-emerald-50 text-emerald-800'
                        : app.status === 'NOT_SELECTED'
                          ? 'bg-navy-100 text-navy-700'
                          : 'bg-navy-50 text-navy-600'
                  }`}
                >
                  {app.status}
                </span>
              </li>
            ))
          )}
        </ul>

        {posting.status === 'OPEN' && remainingSlots > 0 && pending.length > 0 && (
          <div className="px-4 py-3 border-t border-navy-100 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={assignSelected}
              disabled={saving || selectedIds.size === 0}
              className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {saving ? 'Assigning…' : `Assign selected (${selectedIds.size})`}
            </button>
            <span className="text-xs text-navy-800/70">
              {selectedIds.size} of {remainingSlots} free slot(s) in this step
            </span>
          </div>
        )}
      </section>
    </Layout>
  );
}
