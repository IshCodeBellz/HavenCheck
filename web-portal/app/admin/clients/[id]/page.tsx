'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiV1 } from '@/lib/api-v1';
import ClientProfileDetailView, { type ClientDetailModel } from '@/components/client-profile/ClientProfileDetailView';

export default function AdminClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<ClientDetailModel | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiV1.get<ClientDetailModel>(`/admin/clients/${id}`);
      setClient(res.data);
    } catch {
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-navy-800">Loading…</p>;
  if (!client) return <p className="text-red-700">Client not found</p>;

  return (
    <div className="space-y-6">
      <Link href="/admin/clients" className="text-sm text-navy-600 hover:underline">
        ← Back to admin clients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Client record</h2>
          <p className="text-sm text-navy-800/70 mt-1">Read-only summary of portal data and extended care profile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/clients/${id}/edit`}
            className="inline-flex items-center rounded-xl bg-navy-600 text-white px-4 py-2 text-sm font-medium hover:bg-navy-700"
          >
            Edit in portal
          </Link>
          <Link
            href={`/admin/clients/${id}/visits`}
            className="inline-flex items-center rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            Visit history (v1)
          </Link>
          <Link
            href={`/admin/clients/${id}/medications`}
            className="inline-flex items-center rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            Medications (eMAR setup)
          </Link>
          <Link
            href={`/admin/clients/${id}/care-plan`}
            className="inline-flex items-center rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            Care plans
          </Link>
          <Link
            href={`/admin/clients/${id}/risk-assessments`}
            className="inline-flex items-center rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            Risk assessments
          </Link>
        </div>
      </div>

      <ClientProfileDetailView client={client} />

      <details className="rounded-xl border border-navy-100 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-navy-900">Raw JSON (debug)</summary>
        <pre className="mt-3 overflow-x-auto text-xs text-navy-800">{JSON.stringify(client, null, 2)}</pre>
      </details>
    </div>
  );
}
