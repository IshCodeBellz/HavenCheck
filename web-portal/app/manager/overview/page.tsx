'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

interface OverviewResponse {
  activeCarers: number;
  visitsToday: number;
  byStatus: Record<string, number>;
  visits: Array<{
    id: string;
    status: string;
    scheduledStart: string;
    client: { id: string; name: string };
    carer: { id: string; name: string };
    clockInTime?: string | null;
  }>;
}

export default function ManagerOverviewPage() {
  const staffOk = useRequireStaff();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiV1.get<OverviewResponse>('/manager/overview/today');
      setData(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load team overview');
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

  if (loading) {
    return (
      <Layout>
        <p role="status" className="text-navy-800">
          Loading…
        </p>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <p className="text-red-700">{error || 'No data'}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Team overview</h1>
          <p className="text-sm text-navy-800/70 mt-1">
            Live view from <code className="text-xs bg-navy-100 px-1 rounded">GET /api/v1/manager/overview/today</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="cursor-pointer self-start px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium shadow-sm hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-navy-900">{data.activeCarers}</div>
          <div className="text-sm text-navy-800/70 mt-1">Active carers (in progress)</div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-navy-900">{data.visitsToday}</div>
          <div className="text-sm text-navy-800/70 mt-1">Visits today</div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-navy-800 mb-2">By status</div>
          <ul className="text-sm text-navy-800/80 space-y-1">
            {Object.entries(data.byStatus).map(([k, v]) => (
              <li key={k}>
                {k}: <span className="font-semibold text-navy-900">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-navy-900 mb-3">Today&apos;s visits</h2>
      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
        <ul className="divide-y divide-navy-100">
          {data.visits.length === 0 ? (
            <li className="px-4 py-8 text-center text-navy-800/70">No visits scheduled today</li>
          ) : (
            data.visits.map((v) => (
              <li key={v.id} className="px-4 py-3 sm:px-6 hover:bg-navy-50/80">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-medium text-navy-900">{v.client.name}</div>
                    <div className="text-sm text-navy-800/70">
                      {v.carer.name} · {format(new Date(v.scheduledStart), 'HH:mm')}
                      {v.clockInTime ? ` · Clocked in ${format(new Date(v.clockInTime), 'HH:mm')}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-md bg-navy-100 text-navy-800">
                      {v.status}
                    </span>
                    <Link
                      href={`/visits/${v.id}`}
                      className="text-sm font-medium text-navy-600 hover:text-navy-800"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </Layout>
  );
}
