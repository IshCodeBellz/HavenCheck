'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { apiV1 } from '@/lib/api-v1';

interface TimesheetRow {
  visitId: string;
  carerName: string;
  clientName: string;
  scheduledStart: string;
  clockInTime: string;
  clockOutTime: string;
  minutes: number;
}

interface TimesheetSummary {
  carerId: string;
  carerName: string;
  totalMinutes: number;
  visitCount: number;
}

interface TimesheetResponse {
  rows: TimesheetRow[];
  summary: TimesheetSummary[];
}

export default function AdminTimesheetsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [carerId, setCarerId] = useState('');
  const [data, setData] = useState<TimesheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiV1.get<TimesheetResponse>('/admin/reports/timesheets', {
        params: {
          from,
          to,
          ...(carerId.trim() ? { carerId: carerId.trim() } : {}),
        },
      });
      setData(res.data);
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      setError(msg || 'Failed to load timesheets');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, carerId]);

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-navy-900 mb-4">Timesheets</h2>
      <p className="text-sm text-navy-800/70 mb-4">
        <code className="text-xs bg-navy-100 px-1 rounded">GET /api/v1/admin/reports/timesheets</code> — visits with
        clock-in and clock-out in the date range.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="text-sm">
          <span className="block text-navy-800 mb-1">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900"
          />
        </label>
        <label className="text-sm">
          <span className="block text-navy-800 mb-1">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900"
          />
        </label>
        <label className="text-sm min-w-[12rem]">
          <span className="block text-navy-800 mb-1">Carer ID (optional)</span>
          <input
            type="text"
            value={carerId}
            onChange={(e) => setCarerId(e.target.value)}
            placeholder="Filter by carer"
            className="w-full rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="cursor-pointer px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      {data && (
        <>
          <h3 className="text-lg font-medium text-navy-900 mb-2">Summary by carer</h3>
          <div className="overflow-x-auto rounded-xl border border-navy-100 mb-8">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 text-left text-navy-800">
                <tr>
                  <th className="px-3 py-2">Carer</th>
                  <th className="px-3 py-2">Visits</th>
                  <th className="px-3 py-2">Total (min)</th>
                  <th className="px-3 py-2">Total (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 bg-white">
                {data.summary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-navy-800/70">
                      No completed visits in range
                    </td>
                  </tr>
                ) : (
                  data.summary.map((s) => (
                    <tr key={s.carerId}>
                      <td className="px-3 py-2 font-medium text-navy-900">{s.carerName}</td>
                      <td className="px-3 py-2">{s.visitCount}</td>
                      <td className="px-3 py-2">{s.totalMinutes}</td>
                      <td className="px-3 py-2">{(s.totalMinutes / 60).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-medium text-navy-900 mb-2">Visit detail</h3>
          <div className="overflow-x-auto rounded-xl border border-navy-100">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50 text-left text-navy-800">
                <tr>
                  <th className="px-3 py-2">Carer</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Scheduled</th>
                  <th className="px-3 py-2">In</th>
                  <th className="px-3 py-2">Out</th>
                  <th className="px-3 py-2">Minutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 bg-white">
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-navy-800/70">
                      No rows
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.visitId}>
                      <td className="px-3 py-2">{r.carerName}</td>
                      <td className="px-3 py-2">{r.clientName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.scheduledStart ? format(new Date(r.scheduledStart), 'MMM d HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.clockInTime), 'MMM d HH:mm')}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.clockOutTime), 'MMM d HH:mm')}</td>
                      <td className="px-3 py-2">{r.minutes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
