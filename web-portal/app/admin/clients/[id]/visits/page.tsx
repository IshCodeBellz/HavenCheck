'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { useParams } from 'next/navigation';
import { apiV1 } from '@/lib/api-v1';

interface Visit {
  id: string;
  status: string;
  scheduledStart: string;
  carer?: { name: string };
}

export default function AdminClientVisitsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await apiV1.get<Visit[]>(`/admin/clients/${clientId}/visits`, {
        params: { from, to },
      });
      setVisits(res.data);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Link href={`/admin/clients/${clientId}`} className="text-sm text-navy-600 hover:underline">
        ← Client admin detail
      </Link>
      <h2 className="text-xl font-semibold text-navy-900">Client visits (v1)</h2>
      <p className="text-xs text-navy-800/70">
        <code className="bg-navy-100 px-1 rounded">GET /api/v1/admin/clients/:clientId/visits</code>
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          <span className="block mb-1">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-navy-200 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-navy-200 px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-navy-600 text-white text-sm cursor-pointer"
        >
          Apply
        </button>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white">
          {visits.map((v) => (
            <li key={v.id} className="px-4 py-3 flex justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-navy-900">
                  {format(new Date(v.scheduledStart), 'MMM d, yyyy HH:mm')}
                </div>
                <div className="text-xs text-navy-800/70">{v.carer?.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-navy-800">{v.status}</span>
                <Link href={`/visits/${v.id}`} className="text-sm text-navy-600">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
