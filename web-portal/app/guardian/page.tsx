'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

export type GuardianFeedItem = {
  id: string;
  type: 'visit' | 'note' | 'incident';
  createdAt: string;
  client: { id: string; name: string };
  headline: string;
  subheadline?: string;
  visit?: {
    id: string;
    status: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    clockInTime: string | null;
    clockOutTime: string | null;
    durationMinutes: number | null;
    carerName: string | null;
  };
  note?: { id: string; text: string; type: string; priority: string };
  incident?: {
    id: string;
    category: string;
    severity: string;
    status: string;
    safeguardingFlag: boolean;
    details: string | null;
    reportedAt: string;
  };
};

function severityStyles(sev: string): string {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-900 border-red-200';
    case 'HIGH':
      return 'bg-amber-100 text-amber-950 border-amber-200';
    case 'MEDIUM':
      return 'bg-yellow-50 text-yellow-950 border-yellow-200';
    default:
      return 'bg-navy-50 text-navy-900 border-navy-100';
  }
}

function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const a = start ? new Date(start) : null;
  const b = end ? new Date(end) : null;
  if (a && b) {
    return `${a.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} – ${b.toLocaleTimeString([], { timeStyle: 'short' })}`;
  }
  if (a) return a.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return null;
}

function FeedCard({ item }: { item: GuardianFeedItem }) {
  const when = new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  if (item.type === 'visit' && item.visit) {
    const v = item.visit;
    const windowLabel = formatRange(v.scheduledStart, v.scheduledEnd);
    return (
      <article className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm ring-1 ring-black/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Visit</p>
            <h2 className="text-lg font-semibold text-navy-900 mt-0.5">{item.headline}</h2>
            <p className="text-sm text-navy-800/80 mt-1">{item.client.name}</p>
          </div>
          <time className="text-xs text-navy-700/70 whitespace-nowrap" dateTime={item.createdAt}>
            {when}
          </time>
        </div>
        {item.subheadline ? <p className="text-sm font-medium text-navy-800 mb-3">{item.subheadline}</p> : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {windowLabel ? (
            <div>
              <dt className="text-navy-700/70">Scheduled</dt>
              <dd className="text-navy-900">{windowLabel}</dd>
            </div>
          ) : null}
          {v.clockInTime ? (
            <div>
              <dt className="text-navy-700/70">Clock in</dt>
              <dd className="text-navy-900">{new Date(v.clockInTime).toLocaleString()}</dd>
            </div>
          ) : null}
          {v.clockOutTime ? (
            <div>
              <dt className="text-navy-700/70">Clock out</dt>
              <dd className="text-navy-900">{new Date(v.clockOutTime).toLocaleString()}</dd>
            </div>
          ) : null}
          {v.durationMinutes != null ? (
            <div>
              <dt className="text-navy-700/70">Duration</dt>
              <dd className="text-navy-900">{v.durationMinutes} minutes</dd>
            </div>
          ) : null}
        </dl>
      </article>
    );
  }

  if (item.type === 'note' && item.note) {
    const n = item.note;
    return (
      <article className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm ring-1 ring-black/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">Care note</p>
            <h2 className="text-lg font-semibold text-navy-900 mt-0.5">{item.headline}</h2>
            <p className="text-sm text-navy-800/80 mt-1">{item.client.name}</p>
          </div>
          <time className="text-xs text-navy-700/70 whitespace-nowrap" dateTime={item.createdAt}>
            {when}
          </time>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center rounded-full border border-navy-100 bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-800">
            {n.type}
          </span>
          {n.priority === 'HIGH' ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-950">
              High priority
            </span>
          ) : null}
        </div>
        <p className="text-sm text-navy-900 whitespace-pre-wrap leading-relaxed">{n.text}</p>
      </article>
    );
  }

  if (item.type === 'incident' && item.incident) {
    const i = item.incident;
    return (
      <article className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm ring-1 ring-black/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-800/90">Incident</p>
            <h2 className="text-lg font-semibold text-navy-900 mt-0.5">{item.headline}</h2>
            <p className="text-sm text-navy-800/80 mt-1">{item.client.name}</p>
          </div>
          <time className="text-xs text-navy-700/70 whitespace-nowrap" dateTime={item.createdAt}>
            {when}
          </time>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityStyles(i.severity)}`}
          >
            {i.severity}
          </span>
          <span className="inline-flex items-center rounded-full border border-navy-100 bg-white px-2.5 py-0.5 text-xs font-medium text-navy-800">
            {i.status}
          </span>
          {i.safeguardingFlag ? (
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-900">
              Safeguarding
            </span>
          ) : null}
        </div>
        <dl className="text-sm space-y-1 mb-3">
          <div className="flex gap-2">
            <dt className="text-navy-700/70 shrink-0">Category</dt>
            <dd className="text-navy-900">{i.category}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-navy-700/70 shrink-0">Reported</dt>
            <dd className="text-navy-900">{new Date(i.reportedAt).toLocaleString()}</dd>
          </div>
        </dl>
        {i.details ? (
          <p className="text-sm text-navy-900 whitespace-pre-wrap leading-relaxed border-t border-navy-100 pt-3">{i.details}</p>
        ) : (
          <p className="text-sm text-navy-700/70 border-t border-navy-100 pt-3">No additional details recorded.</p>
        )}
      </article>
    );
  }

  return null;
}

export default function GuardianFeedPage() {
  const [items, setItems] = useState<GuardianFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>('');
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const newestRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (opts?: { since?: string; merge?: boolean }) => {
    try {
      setError(null);
      const params: Record<string, string> = {};
      if (clientId) params.clientId = clientId;
      if (opts?.since) params.since = opts.since;
      const res = await api.get<GuardianFeedItem[]>('/guardian/feed', { params });
      const data = res.data;
      if (opts?.merge && opts.since) {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => `${p.type}:${p.id}`));
          const incoming = data.filter((d) => !seen.has(`${d.type}:${d.id}`));
          if (incoming.length > 0) {
            setLiveBanner(`${incoming.length} new update${incoming.length > 1 ? 's' : ''}`);
            window.setTimeout(() => setLiveBanner(null), 6000);
          }
          return [...incoming, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      } else {
        setItems(data);
        if (data[0]) newestRef.current = data[0].createdAt;
      }
    } catch (e: unknown) {
      const maybe = e as { response?: { data?: { message?: string } } };
      setError(maybe.response?.data?.message || 'Could not load feed');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const since = newestRef.current;
      if (!since) return;
      void load({ since, merge: true });
    }, 45000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (!items[0]) return;
    const top = items[0].createdAt;
    const cur = newestRef.current;
    if (!cur || new Date(top).getTime() > new Date(cur).getTime()) {
      newestRef.current = top;
    }
  }, [items]);

  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) {
      m.set(it.client.id, it.client.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Family feed</h1>
            <p className="text-sm text-navy-800/70 mt-1 max-w-xl">
              A calm, read-only timeline of completed visits, care notes, and incidents for the people you are linked to.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-medium text-navy-700" htmlFor="guardian-client-filter">
              Filter by client
            </label>
            <select
              id="guardian-client-filter"
              className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-600 min-w-[12rem]"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">All linked clients</option>
              {clientOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5 text-xs text-navy-800/80">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden />
            Checking for updates every 45s
          </span>
          <Link href="/messages" className="font-medium text-navy-900 underline-offset-2 hover:underline">
            Open care alerts
          </Link>
        </div>

        {liveBanner ? (
          <p
            className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-navy-900"
            role="status"
            aria-live="polite"
          >
            {liveBanner}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-700 mb-4" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 py-12 text-navy-800/80">
            <span className="h-8 w-8 rounded-full border-2 border-accent-200 border-t-navy-600 motion-safe:animate-spin" />
            Loading feed…
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && !error ? (
          <p className="text-sm text-navy-800/70 py-10 text-center rounded-xl border border-dashed border-navy-200 bg-white">
            Nothing to show yet. When visits are completed or your team adds notes, they will appear here.
          </p>
        ) : null}
      </div>
    </Layout>
  );
}
