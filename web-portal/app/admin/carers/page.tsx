'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiV1 } from '@/lib/api-v1';

interface CarerRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

export default function AdminCarersPage() {
  const [carers, setCarers] = useState<CarerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiV1.get<CarerRow[]>('/admin/carers');
      setCarers(res.data);
    } catch {
      setCarers([]);
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
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold text-navy-900">Carers (v1)</h2>
        <Link href="/carers/new" className="text-sm font-medium text-navy-600 hover:underline">
          New carer (portal) →
        </Link>
      </div>
      <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-sm">
        {carers.map((c) => (
          <li key={c.id} className="px-4 py-3 flex justify-between items-center hover:bg-navy-50/60">
            <div>
              <div className="font-medium text-navy-900">{c.name}</div>
              <div className="text-sm text-navy-800/70">{c.email}</div>
            </div>
            <Link href={`/carers/${c.id}/edit`} className="text-sm font-medium text-navy-600 hover:underline">
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
