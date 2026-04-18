'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiV1 } from '@/lib/api-v1';

type RiskTemplate = {
  id: string;
  name: string;
  description: string | null;
  scoringRules: Array<{ key: string; label: string; weight: number }>;
};

type ScoreLine = { key: string; label: string; weight: number; answer: number; contribution: number };

type RiskAssessment = {
  id: string;
  totalScore: number;
  maxScore?: number;
  riskLevel: string;
  reviewedAt: string;
  template: { name: string };
  carePlan: { id: string; status: string } | null;
  scoreBreakdown?: { maxScore: number; lines: ScoreLine[] };
};

type CarePlanOption = { id: string; status: string };

function riskLevelPreview(total: number): string {
  if (total >= 8) return 'HIGH';
  if (total >= 4) return 'MEDIUM';
  return 'LOW';
}

function previewScore(
  rules: RiskTemplate['scoringRules'],
  answers: Record<string, number>
): { total: number; max: number; level: string } {
  let total = 0;
  let max = 0;
  for (const rule of rules) {
    const a = Math.min(3, Math.max(0, Math.trunc(answers[rule.key] ?? 0)));
    total += a * rule.weight;
    max += 3 * rule.weight;
  }
  return { total, max, level: riskLevelPreview(total) };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

export default function AdminClientRiskAssessmentsPage() {
  const { id } = useParams<{ id: string }>();
  const [templates, setTemplates] = useState<RiskTemplate[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlanOption[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [carePlanId, setCarePlanId] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, assessmentsRes, plansRes] = await Promise.all([
        apiV1.get<RiskTemplate[]>('/risk-assessments/templates'),
        apiV1.get<RiskAssessment[]>(`/risk-assessments/client/${id}`),
        apiV1.get<CarePlanOption[]>(`/care-plans/client/${id}`),
      ]);
      setTemplates(templatesRes.data);
      setAssessments(assessmentsRes.data);
      setCarePlans(plansRes.data.map((plan) => ({ id: plan.id, status: plan.status })));
      if (templatesRes.data.length > 0 && !templateId) {
        setTemplateId(templatesRes.data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeTemplate) return;
    setAnswers(
      activeTemplate.scoringRules.reduce((acc, rule) => {
        acc[rule.key] = 0;
        return acc;
      }, {} as Record<string, number>)
    );
  }, [activeTemplate?.id]);

  const livePreview = useMemo(() => {
    if (!activeTemplate) return null;
    return previewScore(activeTemplate.scoringRules, answers);
  }, [activeTemplate, answers]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiV1.post('/risk-assessments/assessments', {
        clientId: id,
        templateId,
        carePlanId: carePlanId || undefined,
        answers,
      });
      await load();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to save assessment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={`/admin/clients/${id}`} className="text-sm text-navy-600 hover:underline">
        ← Back to client
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Risk assessments</h2>
        <p className="mt-1 text-sm text-navy-800/70">Falls, pressure sores, and nutrition scoring linked to care plans.</p>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-navy-100 bg-white p-4">
        <h3 className="font-medium text-navy-900">New assessment</h3>
        <select
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          required
        >
          <option value="">Select template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
          value={carePlanId}
          onChange={(e) => setCarePlanId(e.target.value)}
        >
          <option value="">No linked care plan</option>
          {carePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.status} · {plan.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {activeTemplate?.scoringRules.map((rule) => (
          <label key={rule.key} className="block text-sm text-navy-800">
            {rule.label} (weight {rule.weight})
            <input
              type="number"
              min={0}
              max={3}
              value={answers[rule.key] ?? 0}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [rule.key]: Number(e.target.value || 0) }))
              }
              className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2"
            />
          </label>
        ))}
        {livePreview && (
          <div className="rounded-lg border border-navy-200 bg-navy-50/60 p-3 text-sm text-navy-900">
            <p className="font-medium">Score preview</p>
            <p>
              Total {livePreview.total}
              {livePreview.max ? ` / max ${livePreview.max}` : ''} · Band {livePreview.level}
            </p>
            <p className="mt-1 text-xs text-navy-700">Each answer is 0–3; contribution is answer × weight.</p>
          </div>
        )}
        <button
          disabled={saving || !templateId}
          className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save assessment'}
        </button>
      </form>

      <section className="rounded-xl border border-navy-100 bg-white p-4">
        <h3 className="mb-3 font-medium text-navy-900">Previous assessments</h3>
        {loading ? (
          <p className="text-sm text-navy-700">Loading…</p>
        ) : assessments.length === 0 ? (
          <p className="text-sm text-navy-700">No assessments created yet.</p>
        ) : (
          <div className="space-y-2">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="rounded-lg border border-navy-100 p-3 text-sm">
                <p className="font-medium text-navy-900">{assessment.template.name}</p>
                <p className="text-navy-800">
                  Score: {assessment.totalScore}
                  {typeof assessment.maxScore === 'number' ? ` / ${assessment.maxScore}` : ''} · Risk:{' '}
                  {assessment.riskLevel}
                </p>
                {assessment.scoreBreakdown?.lines && assessment.scoreBreakdown.lines.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-navy-100 pt-2 text-xs text-navy-800">
                    {assessment.scoreBreakdown.lines.map((line) => (
                      <li key={line.key}>
                        {line.label}: answer {line.answer} × weight {line.weight} = {line.contribution}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-navy-700">
                  Reviewed {new Date(assessment.reviewedAt).toLocaleString()}
                  {assessment.carePlan ? ` · Linked plan: ${assessment.carePlan.id.slice(0, 8)}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
