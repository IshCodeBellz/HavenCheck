'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { apiV1 } from '@/lib/api-v1';

interface Visit {
  id: string;
  status: string;
  scheduledStart: string;
  client?: { name: string };
  carer?: { name: string };
}

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd');
      const endDate = format(subDays(new Date(), -14), 'yyyy-MM-dd');
      const res = await apiV1.get<Visit[]>('/admin/visits', {
        params: { startDate, endDate },
      });
      setVisits(res.data);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-navy-800">Loading…</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-navy-900 mb-4">Visits (v1)</h2>
      <p className="text-xs text-navy-800/70 mb-4">Showing ±14 days from today.</p>
      <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-sm">
        {visits.map((v) => (
          <li key={v.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="font-medium text-navy-900">
                {v.client?.name} · {v.carer?.name}
              </div>
              <div className="text-sm text-navy-800/70">
                {format(new Date(v.scheduledStart), 'MMM d, yyyy HH:mm')} · {v.status}
              </div>
            </div>
            <Link href={`/visits/${v.id}`} className="text-sm font-medium text-navy-600 hover:underline">
              Open in portal
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
