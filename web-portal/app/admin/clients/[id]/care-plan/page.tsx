'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiV1 } from '@/lib/api-v1';
import CarePlanEditor, { type CarePlanSectionInput } from '@/components/care-plan/CarePlanEditor';

type CarePlan = {
  id: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  reviewDate: string | null;
  reviewReminderAt: string | null;
  reviewReminderSentAt: string | null;
  currentVersion: {
    id: string;
    version: number;
    summary: string | null;
    sections: Array<{ id: string; sectionType: string; title: string; body: string }>;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

function toIsoDate(d: string): string | undefined {
  if (!d) return undefined;
  return new Date(`${d}T09:00:00.000Z`).toISOString();
}

function mapSectionsForEditor(
  sections: Array<{ sectionType: string; title: string; body: string }> | undefined
): CarePlanSectionInput[] | undefined {
  if (!sections?.length) return undefined;
  return sections.map((s) => ({
    sectionType: s.sectionType as CarePlanSectionInput['sectionType'],
    title: s.title,
    body: s.body,
  }));
}

function isReviewOverdue(plan: CarePlan): boolean {
  if (plan.status !== 'ACTIVE' || !plan.reviewDate) return false;
  return new Date(plan.reviewDate).getTime() < Date.now();
}

function isReminderDue(plan: CarePlan): boolean {
  if (plan.status !== 'ACTIVE' || !plan.reviewReminderAt) return false;
  return new Date(plan.reviewReminderAt).getTime() <= Date.now();
}

export default function AdminClientCarePlanPage() {
  const { id } = useParams<{ id: string }>();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDate, setReviewDate] = useState('');
  const [reviewReminderAt, setReviewReminderAt] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiV1.get<CarePlan[]>(`/care-plans/client/${id}`);
      setPlans(response.data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const createPlan = async (payload: { summary?: string; sections: CarePlanSectionInput[] }) => {
    setSaving(true);
    setError(null);
    try {
      await apiV1.post('/care-plans', {
        clientId: id,
        status,
        reviewDate: toIsoDate(reviewDate),
        reviewReminderAt: toIsoDate(reviewReminderAt),
        sections: payload.sections,
        summary: payload.summary,
      });
      await load();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create care plan'));
    } finally {
      setSaving(false);
    }
  };

  const createVersion = async (carePlanId: string, payload: { summary?: string; sections: CarePlanSectionInput[] }) => {
    setSaving(true);
    setError(null);
    try {
      await apiV1.post(`/care-plans/${carePlanId}/versions`, payload);
      await load();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create version'));
    } finally {
      setSaving(false);
    }
  };

  const updatePlanMeta = async (
    carePlanId: string,
    body: {
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      reviewDate?: string | null;
      reviewReminderAt?: string | null;
    }
  ) => {
    setSaving(true);
    setError(null);
    try {
      await apiV1.patch(`/care-plans/${carePlanId}`, body);
      await load();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to update plan'));
    } finally {
      setSaving(false);
    }
  };

  const planAlerts = useMemo(
    () => ({
      overdue: plans.filter(isReviewOverdue),
      reminders: plans.filter((p) => isReminderDue(p) && !p.reviewReminderSentAt),
    }),
    [plans]
  );

  return (
    <div className="space-y-6">
      <Link href={`/admin/clients/${id}`} className="text-sm text-navy-600 hover:underline">
        ← Back to client
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Structured care plans</h2>
        <p className="mt-1 text-sm text-navy-800/70">Versioned plans with needs, strengths, risks, and actions.</p>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {(planAlerts.overdue.length > 0 || planAlerts.reminders.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {planAlerts.overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-medium">Review overdue</p>
              <p className="text-red-800">This client has {planAlerts.overdue.length} active plan(s) past review date.</p>
            </div>
          )}
          {planAlerts.reminders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Reminder due</p>
              <p className="text-amber-800">
                {planAlerts.reminders.length} active plan(s) have a review reminder scheduled and not marked sent.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm text-navy-800">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}
            className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label className="text-sm text-navy-800">
          Review date
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2"
          />
        </label>
        <label className="text-sm text-navy-800">
          Review reminder
          <input
            type="date"
            value={reviewReminderAt}
            onChange={(e) => setReviewReminderAt(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-navy-700">Shows on the org care plan reminders list when due.</span>
        </label>
      </div>

      <CarePlanEditor onSubmit={createPlan} saving={saving} submitLabel="Create care plan" resetKey="create" />

      <section className="space-y-4">
        <h3 className="font-medium text-navy-900">Existing care plans</h3>
        {loading ? (
          <p className="text-sm text-navy-700">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="rounded-xl border border-navy-100 bg-white p-4 text-sm text-navy-700">No plans created yet.</p>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              saving={saving}
              onUpdateMeta={updatePlanMeta}
              onMarkReminderSent={async () => {
                setSaving(true);
                try {
                  await apiV1.post(`/care-plans/${plan.id}/reminders/mark-sent`);
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
              onCreateVersion={(payload) => createVersion(plan.id, payload)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  saving,
  onUpdateMeta,
  onMarkReminderSent,
  onCreateVersion,
}: {
  plan: CarePlan;
  saving: boolean;
  onUpdateMeta: (
    id: string,
    body: { status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; reviewDate?: string | null; reviewReminderAt?: string | null }
  ) => Promise<void>;
  onMarkReminderSent: () => Promise<void>;
  onCreateVersion: (payload: { summary?: string; sections: CarePlanSectionInput[] }) => Promise<void>;
}) {
  const [editStatus, setEditStatus] = useState(plan.status);
  const [editReview, setEditReview] = useState(plan.reviewDate ? plan.reviewDate.slice(0, 10) : '');
  const [editReminder, setEditReminder] = useState(plan.reviewReminderAt ? plan.reviewReminderAt.slice(0, 10) : '');

  useEffect(() => {
    setEditStatus(plan.status);
    setEditReview(plan.reviewDate ? plan.reviewDate.slice(0, 10) : '');
    setEditReminder(plan.reviewReminderAt ? plan.reviewReminderAt.slice(0, 10) : '');
  }, [plan.status, plan.reviewDate, plan.reviewReminderAt]);

  const overdue = isReviewOverdue(plan);
  const reminderDue = isReminderDue(plan);

  return (
    <div className="space-y-3 rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-navy-900">
            {plan.status} {plan.currentVersion ? `· v${plan.currentVersion.version}` : ''}
          </p>
          <p className="text-xs text-navy-700">
            Review: {plan.reviewDate ? new Date(plan.reviewDate).toLocaleDateString() : 'Not set'}
            {plan.reviewReminderAt ? ` · Reminder: ${new Date(plan.reviewReminderAt).toLocaleDateString()}` : ''}
            {plan.reviewReminderSentAt ? ` · Reminder sent ${new Date(plan.reviewReminderSentAt).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Overdue review</span>
          )}
          {reminderDue && !plan.reviewReminderSentAt && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Reminder due</span>
          )}
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-navy-100 p-3 sm:grid-cols-3">
        <label className="text-xs text-navy-800">
          Status
          <select
            className="mt-1 block w-full rounded border border-navy-200 px-2 py-1.5 text-sm"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label className="text-xs text-navy-800">
          Review date
          <input
            type="date"
            className="mt-1 block w-full rounded border border-navy-200 px-2 py-1.5 text-sm"
            value={editReview}
            onChange={(e) => setEditReview(e.target.value)}
          />
        </label>
        <label className="text-xs text-navy-800">
          Reminder date
          <input
            type="date"
            className="mt-1 block w-full rounded border border-navy-200 px-2 py-1.5 text-sm"
            value={editReminder}
            onChange={(e) => setEditReminder(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onUpdateMeta(plan.id, {
                status: editStatus,
                reviewDate: editReview ? toIsoDate(editReview)! : null,
                reviewReminderAt: editReminder ? toIsoDate(editReminder)! : null,
              })
            }
            className="rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
          >
            Save review settings
          </button>
          {reminderDue && !plan.reviewReminderSentAt && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onMarkReminderSent()}
              className="rounded-lg border border-navy-300 px-3 py-1.5 text-sm text-navy-900 hover:bg-navy-50 disabled:opacity-60"
            >
              Mark reminder sent
            </button>
          )}
        </div>
      </div>

      {plan.currentVersion?.sections?.map((section) => (
        <div key={section.id} className="rounded-lg border border-navy-100 p-3">
          <p className="text-xs font-semibold text-navy-700">{section.sectionType}</p>
          <p className="mt-1 font-medium text-navy-900">{section.title}</p>
          <p className="mt-1 text-sm text-navy-800">{section.body}</p>
        </div>
      ))}
      <CarePlanEditor
        onSubmit={onCreateVersion}
        saving={saving}
        submitLabel="Create new version"
        resetKey={`${plan.id}-v${plan.currentVersion?.version ?? 0}`}
        initialSummary={plan.currentVersion?.summary ?? ''}
        initialSections={
          plan.currentVersion?.sections ? mapSectionsForEditor(plan.currentVersion.sections) : undefined
        }
      />
    </div>
  );
}
