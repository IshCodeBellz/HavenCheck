'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useParams } from 'next/navigation';
import { apiV1 } from '@/lib/api-v1';

export default function AdminScheduleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiV1.get(`/admin/schedules/${id}`);
      setRow(res.data as Record<string, unknown>);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p>Loading…</p>;
  if (!row) return <p className="text-red-700">Schedule not found</p>;

  const startTime = row.startTime as string;
  const endTime = row.endTime as string;
  const client = row.client as { name?: string } | undefined;
  const carer = row.carer as { name?: string } | undefined;

  return (
    <div className="space-y-4">
      <Link href="/admin/schedules" className="text-sm text-navy-600 hover:underline">
        ← Schedules
      </Link>
      <h2 className="text-xl font-semibold text-navy-900">Schedule (v1)</h2>
      <div className="rounded-xl border border-navy-100 bg-white p-4 text-sm space-y-1">
        <div>
          <span className="text-navy-800/70">Client:</span> {client?.name}
        </div>
        <div>
          <span className="text-navy-800/70">Carer:</span> {carer?.name}
        </div>
        <div>
          <span className="text-navy-800/70">Start:</span> {format(new Date(startTime), 'PPp')}
        </div>
        <div>
          <span className="text-navy-800/70">End:</span> {format(new Date(endTime), 'PPp')}
        </div>
      </div>
      <Link
        href={`/schedules/${id}/edit`}
        className="inline-flex rounded-xl bg-navy-600 text-white px-4 py-2 text-sm font-medium hover:bg-navy-700"
      >
        Edit in portal
      </Link>
      <details className="rounded-xl border border-navy-100 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-navy-900">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(row, null, 2)}</pre>
      </details>
    </div>
  );
}
