'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type ShiftPostingRow = {
  id: string;
  title: string | null;
  status: string;
  slotsNeeded: number;
  startTime: string;
  endTime: string;
  client: { id: string; name: string };
  applications: { status: string }[];
};

export default function ManagerOpenShiftsPage() {
  const staffOk = useRequireStaff();
  const [items, setItems] = useState<ShiftPostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<ShiftPostingRow[]>('/manager/shift-postings');
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
    if (staffOk) load();
  }, [staffOk, load]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Open shifts</h1>
          <p className="text-sm text-navy-800/70 mt-1">
            Post shifts with multiple slots. Carers apply; you choose who fills each slot.
          </p>
        </div>
        <Link
          href="/manager/open-shifts/new"
          className="inline-flex justify-center rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
        >
          Post a shift
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-navy-800">Loading…</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-sm">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-navy-800/70">No shift postings yet.</li>
          ) : (
            items.map((row) => {
              const applicants = row.applications?.length ?? 0;
              const selected = row.applications?.filter((a) => a.status === 'SELECTED').length ?? 0;
              return (
                <li key={row.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-medium text-navy-900">
                      {row.client.name}
                      {row.title ? ` · ${row.title}` : ''}
                    </div>
                    <div className="text-sm text-navy-800/70">
                      {format(new Date(row.startTime), 'MMM d, yyyy HH:mm')} –{' '}
                      {format(new Date(row.endTime), 'HH:mm')} · {selected}/{row.slotsNeeded} filled · {applicants}{' '}
                      application{applicants === 1 ? '' : 's'}
                    </div>
                    <div className="text-xs mt-1">
                      <span
                        className={
                          row.status === 'OPEN'
                            ? 'text-emerald-700'
                            : row.status === 'FILLED'
                              ? 'text-navy-600'
                              : 'text-amber-800'
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/manager/open-shifts/${row.id}`}
                    className="text-sm font-medium text-navy-600 hover:underline shrink-0"
                  >
                    Manage
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}
    </Layout>
  );
}
