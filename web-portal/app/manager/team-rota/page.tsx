'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import Layout from '@/components/Layout';
import { apiV1 } from '@/lib/api-v1';
import { useRequireStaff } from '@/hooks/useRequireStaff';

type ScheduleRow = {
  id: string;
  startTime: string;
  endTime: string;
  client: { name: string };
  carer: { id: string; name: string };
};

interface RotaResponse {
  weekStart: string;
  schedules: Record<string, ScheduleRow[]>;
}

function mondayOfWeek(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export default function ManagerTeamRotaPage() {
  const staffOk = useRequireStaff();
  const [weekAnchor, setWeekAnchor] = useState(() => mondayOfWeek(new Date()));
  const [data, setData] = useState<RotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startParam = format(weekAnchor, 'yyyy-MM-dd');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiV1.get<RotaResponse>('/manager/team-rota/week', {
        params: { start: startParam },
      });
      setData(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load team rota');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startParam]);

  useEffect(() => {
    if (staffOk) load();
  }, [staffOk, load]);

  const dayKeys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekAnchor, i), 'yyyy-MM-dd'));
  }, [weekAnchor]);

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
          <h1 className="text-3xl font-bold text-navy-900">Team rota</h1>
          <p className="text-sm text-navy-800/70 mt-1">
            Week of {format(weekAnchor, 'MMM d, yyyy')} ·{' '}
            <code className="text-xs bg-navy-100 px-1 rounded">GET /api/v1/manager/team-rota/week</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDays(d, -7))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            Previous week
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(mondayOfWeek(new Date()))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDays(d, 7))}
            className="cursor-pointer px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-800 hover:bg-navy-50"
          >
            Next week
          </button>
          <button
            type="button"
            onClick={load}
            className="cursor-pointer px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium shadow-sm hover:bg-navy-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <p role="status" className="text-navy-800">
          Loading…
        </p>
      )}
      {error && <p className="text-red-700 mb-4">{error}</p>}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {dayKeys.map((dayKey) => {
            const entries = data.schedules[dayKey] || [];
            const label = format(new Date(dayKey + 'T12:00:00'), 'EEE MMM d');
            return (
              <div
                key={dayKey}
                className="rounded-2xl border border-navy-100 bg-white shadow-sm min-h-[120px] flex flex-col"
              >
                <div className="px-3 py-2 border-b border-navy-100 bg-navy-50/80 rounded-t-2xl">
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-800/70">Day</div>
                  <div className="text-sm font-semibold text-navy-900">{label}</div>
                </div>
                <ul className="p-2 space-y-2 flex-1">
                  {entries.length === 0 ? (
                    <li className="text-xs text-navy-800/50 px-1 py-2">No shifts</li>
                  ) : (
                    entries.map((s) => (
                      <li
                        key={s.id}
                        className="text-xs rounded-lg border border-navy-100 bg-white px-2 py-2 shadow-sm"
                      >
                        <div className="font-medium text-navy-900">{s.client.name}</div>
                        <div className="text-navy-800/80">{s.carer.name}</div>
                        <div className="text-navy-800/60 mt-0.5">
                          {format(new Date(s.startTime), 'HH:mm')}–{format(new Date(s.endTime), 'HH:mm')}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
