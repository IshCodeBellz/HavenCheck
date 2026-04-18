'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

type InboxMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  thread: { id: string; subject: string | null };
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get<InboxMessage[]>('/carer/messages/inbox');
        setMessages(res.data);
      } catch (e: unknown) {
        const maybe = e as { response?: { data?: { message?: string } } };
        setError(maybe.response?.data?.message || 'Could not load alerts');
      }
    };
    void run();
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">Care alerts</h1>
        <p className="text-sm text-navy-800/70 mb-6">
          Visit summaries and incident notifications appear here when your care team shares updates.
        </p>
        {error ? (
          <p className="text-sm text-red-700 mb-4" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl border p-4 shadow-sm ${
                m.readAt ? 'border-navy-100 bg-white' : 'border-accent-200 bg-accent-50/40'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-navy-900">{m.thread.subject || 'Update'}</p>
                <time className="text-xs text-navy-800/60" dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="text-sm text-navy-800 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
        {messages.length === 0 && !error ? (
          <p className="text-sm text-navy-800/70 py-8 text-center rounded-xl border border-dashed border-navy-200 bg-white">
            No alerts yet. You will see messages when visits complete or incidents are logged for someone you follow.
          </p>
        ) : null}
      </div>
    </Layout>
  );
}
