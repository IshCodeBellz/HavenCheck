'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiV1 } from '@/lib/api-v1';

interface Client {
  id: string;
  name: string;
  address: string;
  active?: boolean;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiV1.get<Client[]>('/admin/clients');
      setClients(res.data);
    } catch (e) {
      console.error(e);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Soft-delete this client via admin API?')) return;
    setDeletingId(id);
    try {
      await apiV1.delete(`/admin/clients/${id}`);
      await load();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : 'Delete failed';
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <p className="text-navy-800">Loading…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold text-navy-900">Clients (v1)</h2>
        <Link
          href="/clients/new"
          className="text-sm font-medium text-navy-600 hover:text-navy-800"
        >
          Add client (portal) →
        </Link>
      </div>
      <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
        {clients.map((c) => (
          <li key={c.id} className="flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-0 sm:gap-2 hover:bg-navy-50/60">
            <Link
              href={`/admin/clients/${c.id}`}
              className="flex-1 px-4 py-3 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500"
            >
              <div className="font-medium text-navy-900">{c.name}</div>
              <div className="text-sm text-navy-800/70 truncate">{c.address}</div>
              <span className="text-xs text-navy-600 mt-1 inline-block">View full profile →</span>
            </Link>
            <div className="px-4 pb-3 sm:py-3 flex flex-wrap items-center gap-2 sm:border-l sm:border-navy-100 sm:shrink-0">
              <Link href={`/clients/${c.id}/edit`} className="text-sm text-navy-600 font-medium hover:underline">
                Edit profile
              </Link>
              <button
                type="button"
                disabled={deletingId === c.id}
                onClick={() => handleDelete(c.id)}
                className="text-sm text-red-700 font-medium hover:underline disabled:opacity-50 cursor-pointer"
              >
                {deletingId === c.id ? 'Deleting…' : 'Delete (v1)'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
