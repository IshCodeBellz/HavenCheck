'use client';

import { useEffect, useState } from 'react';
import { apiV1 } from '@/lib/api-v1';

type Template = {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
};

export default function AdminRiskAssessmentTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiV1
      .get<Template[]>('/risk-assessments/templates')
      .then((res) => {
        if (!cancelled) setTemplates(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-navy-900">Risk templates</h2>
        <p className="mt-1 text-sm text-navy-800/70">
          Organization templates for falls, pressure sores, and nutrition scoring.
        </p>
      </div>
      <section className="rounded-xl border border-navy-100 bg-white p-4">
        {loading ? (
          <p className="text-sm text-navy-700">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-navy-700">No templates available.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-navy-100 p-3">
                <p className="font-medium text-navy-900">{template.name}</p>
                <p className="text-xs text-navy-600">{template.templateType}</p>
                {template.description && <p className="mt-1 text-sm text-navy-800">{template.description}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
