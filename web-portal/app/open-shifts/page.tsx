'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { authService, User } from '@/lib/auth';
import { isCarer } from '@/lib/roles';

type OpenShiftRow = {
  id: string;
  title: string | null;
  status: string;
  slotsNeeded: number;
  startTime: string;
  endTime: string;
  client: { id: string; name: string };
  selectedCount: number;
  pendingCount: number;
  applicantCount: number;
  myApplicationStatus: string | null;
  myApplicationId: string | null;
};

export default function CarerOpenShiftsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<OpenShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<OpenShiftRow[]>('/carer/open-shifts');
      setItems(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load open shifts');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (applicationId: string) => {
    setBusyId(applicationId);
    setError(null);
    try {
      await apiV1.post(`/carer/open-shifts/applications/${applicationId}/withdraw`);
      await load();
    } catch (err: unknown) {
      const d =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : undefined;
      setError(d?.message || 'Could not withdraw');
    } finally {
      setBusyId(null);
    }
  };

  const apply = async (shiftId: string) => {
    setBusyId(shiftId);
    setError(null);
    try {
      await apiV1.post(`/carer/open-shifts/${shiftId}/apply`);
      await load();
    } catch (err: unknown) {
      const d =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string; code?: string } } }).response?.data
          : undefined;
      setError(d?.message || 'Could not apply');
    } finally {
      setBusyId(null);
    }
  };

  const canApply = user && isCarer(user);

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Open shifts</h1>
      <p className="text-sm text-navy-800/70 mb-6">
        Shifts your organisation has posted for multiple carers. Apply to register interest; managers assign slots from
        applicants.
      </p>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      {!canApply && user && (
        <p className="text-sm text-navy-800/80 mb-4">Applications are available to carer accounts.</p>
      )}

      {loading ? (
        <p className="text-navy-800">Loading…</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-sm">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-navy-800/70">No open shifts right now.</li>
          ) : (
            items.map((row) => {
              const free = Math.max(0, row.slotsNeeded - row.selectedCount);
              const mine = row.myApplicationStatus;
              return (
                <li key={row.id} className="px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-navy-900">
                      {row.client.name}
                      {row.title ? ` · ${row.title}` : ''}
                    </div>
                    <div className="text-sm text-navy-800/70">
                      {format(new Date(row.startTime), 'EEE d MMM, HH:mm')} – {format(new Date(row.endTime), 'HH:mm')}
                    </div>
                    <div className="text-xs text-navy-800/60 mt-1">
                      {row.selectedCount}/{row.slotsNeeded} filled · {row.applicantCount} applicant
                      {row.applicantCount === 1 ? '' : 's'}
                      {free > 0 ? ` · ${free} slot(s) open` : ''}
                    </div>
                    {mine && (
                      <div className="text-xs font-medium text-navy-700 mt-1">Your application: {mine}</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {canApply && row.status === 'OPEN' && free > 0 && !mine && (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => apply(row.id)}
                        className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                      >
                        {busyId === row.id ? 'Applying…' : 'Apply'}
                      </button>
                    )}
                    {canApply && mine === 'PENDING' && row.myApplicationId && (
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-sm font-medium text-sky-800">Applied</span>
                        <button
                          type="button"
                          disabled={busyId === row.myApplicationId}
                          onClick={() => withdraw(row.myApplicationId!)}
                          className="text-xs text-navy-600 hover:underline disabled:opacity-50"
                        >
                          {busyId === row.myApplicationId ? 'Withdrawing…' : 'Withdraw application'}
                        </button>
                      </div>
                    )}
                    {mine === 'SELECTED' && (
                      <span className="text-sm font-medium text-emerald-800">You are assigned</span>
                    )}
                    {mine === 'NOT_SELECTED' && (
                      <span className="text-sm text-navy-700">Not selected this time</span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </Layout>
  );
}
