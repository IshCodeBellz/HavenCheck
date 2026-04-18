'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiV1 } from '@/lib/api-v1';

type ReviewPlan = {
  id: string;
  status: string;
  reviewDate: string | null;
  reviewReminderAt: string | null;
  client: { id: string; name: string };
};

export default function AdminCarePlansOverviewPage() {
  const [overdue, setOverdue] = useState<ReviewPlan[]>([]);
  const [reminders, setReminders] = useState<ReviewPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overdueRes, remindersRes] = await Promise.all([
        apiV1.get<ReviewPlan[]>('/care-plans/reviews/overdue'),
        apiV1.get<ReviewPlan[]>('/care-plans/reviews/reminders'),
      ]);
      setOverdue(overdueRes.data);
      setReminders(remindersRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Care plan review system</h2>
        <p className="mt-1 text-sm text-navy-800/70">Track overdue plans and scheduled reminders.</p>
      </div>
      {loading ? (
        <p className="text-sm text-navy-700">Loading…</p>
      ) : (
        <>
          <section className="rounded-xl border border-navy-100 bg-white p-4">
            <h3 className="mb-3 font-medium text-navy-900">Overdue active plans</h3>
            {overdue.length === 0 ? (
              <p className="text-sm text-navy-700">No overdue plans.</p>
            ) : (
              <div className="space-y-2">
                {overdue.map((plan) => (
                  <Link
                    href={`/admin/clients/${plan.client.id}/care-plan`}
                    key={plan.id}
                    className="block rounded-lg border border-red-200 bg-red-50 p-3"
                  >
                    <p className="font-medium text-red-900">{plan.client.name}</p>
                    <p className="text-sm text-red-800">
                      Review due: {plan.reviewDate ? new Date(plan.reviewDate).toLocaleDateString() : 'Not set'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-navy-100 bg-white p-4">
            <h3 className="mb-3 font-medium text-navy-900">Scheduled reminders</h3>
            {reminders.length === 0 ? (
              <p className="text-sm text-navy-700">No reminders due.</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((plan) => (
                  <Link
                    href={`/admin/clients/${plan.client.id}/care-plan`}
                    key={plan.id}
                    className="block rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <p className="font-medium text-amber-900">{plan.client.name}</p>
                    <p className="text-sm text-amber-800">
                      Reminder date:{' '}
                      {plan.reviewReminderAt ? new Date(plan.reviewReminderAt).toLocaleDateString() : 'Not set'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
