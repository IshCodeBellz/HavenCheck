'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiV1 } from '@/lib/api-v1';

export type CarePlanSectionInput = {
  sectionType: 'NEEDS' | 'STRENGTHS' | 'RISKS' | 'ACTIONS';
  title: string;
  body: string;
};

type CarePlanTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sections: Array<{
    sectionType: CarePlanSectionInput['sectionType'];
    title: string;
    body?: string;
    orderIndex?: number;
  }>;
};

const SECTION_TYPES: CarePlanSectionInput['sectionType'][] = ['NEEDS', 'STRENGTHS', 'RISKS', 'ACTIONS'];

const emptySection = (sectionType: CarePlanSectionInput['sectionType']): CarePlanSectionInput => ({
  sectionType,
  title: '',
  body: '',
});

const defaultSections: CarePlanSectionInput[] = [
  { sectionType: 'NEEDS', title: 'Needs', body: '' },
  { sectionType: 'STRENGTHS', title: 'Strengths', body: '' },
  { sectionType: 'RISKS', title: 'Risks', body: '' },
  { sectionType: 'ACTIONS', title: 'Actions', body: '' },
];

type Props = {
  onSubmit: (payload: { summary?: string; sections: CarePlanSectionInput[] }) => Promise<void>;
  saving?: boolean;
  submitLabel?: string;
  /** When this value changes, form resets from `initialSummary` / `initialSections` when provided, else defaults. */
  resetKey?: string | number;
  initialSummary?: string;
  initialSections?: CarePlanSectionInput[];
  showTemplatePicker?: boolean;
};

function normalizeTemplateSections(raw: unknown): CarePlanSectionInput[] {
  if (!Array.isArray(raw)) return [...defaultSections];
  const mapped = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const sectionType = o.sectionType;
      if (sectionType !== 'NEEDS' && sectionType !== 'STRENGTHS' && sectionType !== 'RISKS' && sectionType !== 'ACTIONS') {
        return null;
      }
      const title = typeof o.title === 'string' ? o.title : '';
      const body = typeof o.body === 'string' ? o.body : '';
      return { sectionType, title, body };
    })
    .filter(Boolean) as CarePlanSectionInput[];
  return mapped.length > 0 ? mapped : [...defaultSections];
}

export default function CarePlanEditor({
  onSubmit,
  saving = false,
  submitLabel = 'Save',
  resetKey = 'default',
  initialSummary,
  initialSections,
  showTemplatePicker = true,
}: Props) {
  const [summary, setSummary] = useState(initialSummary ?? '');
  const [sections, setSections] = useState<CarePlanSectionInput[]>(
    initialSections && initialSections.length > 0 ? initialSections : defaultSections
  );
  const [templates, setTemplates] = useState<CarePlanTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');

  const loadTemplates = useCallback(async () => {
    if (!showTemplatePicker) return;
    try {
      const res = await apiV1.get<CarePlanTemplate[]>('/care-plans/templates');
      setTemplates(res.data);
    } catch {
      setTemplates([]);
    }
  }, [showTemplatePicker]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (initialSections && initialSections.length > 0) {
      setSections(initialSections.map((s) => ({ ...s })));
      setSummary(initialSummary ?? '');
    } else {
      setSections([...defaultSections]);
      setSummary(initialSummary ?? '');
    }
    // Intentionally keyed only by resetKey so inline parent arrays do not thrash edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const valid = useMemo(
    () => sections.length > 0 && sections.every((section) => section.title.trim() && section.body.trim()),
    [sections]
  );

  const applyTemplate = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSections(normalizeTemplateSections(template.sections));
  };

  const addSection = () => {
    setSections((prev) => [...prev, emptySection('ACTIONS')]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    await onSubmit({
      summary: summary.trim() || undefined,
      sections: sections.map((section, index) => ({
        ...section,
        title: section.title.trim(),
        body: section.body.trim(),
        orderIndex: index,
      })),
    });
    if (!initialSections) {
      setSummary('');
      setSections([...defaultSections]);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-navy-100 bg-white p-4">
      <h3 className="font-medium text-navy-900">Care plan content</h3>
      {showTemplatePicker && templates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-navy-200 p-3">
          <label className="min-w-[12rem] flex-1 text-sm text-navy-800">
            Template
            <select
              className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => {
                const v = e.target.value;
                setTemplateId(v);
                if (v) applyTemplate(v);
              }}
            >
              <option value="">Custom / blank</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-navy-700">Loads section titles and placeholders; edit freely before saving.</p>
        </div>
      )}
      <textarea
        className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
        placeholder="Version summary (optional)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addSection}
          className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-sm text-navy-900 hover:bg-navy-100"
        >
          Add section
        </button>
      </div>
      {sections.map((section, index) => (
        <div key={`${resetKey}-${index}`} className="space-y-2 rounded-lg border border-navy-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              className="rounded-lg border border-navy-200 px-2 py-1 text-xs font-semibold tracking-wide text-navy-800"
              value={section.sectionType}
              onChange={(e) =>
                setSections((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, sectionType: e.target.value as CarePlanSectionInput['sectionType'] } : item
                  )
                )
              }
            >
              {SECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeSection(index)}
              disabled={sections.length <= 1}
              className="text-xs text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          <input
            className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
            value={section.title}
            onChange={(e) =>
              setSections((prev) => prev.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))
            }
            required
          />
          <textarea
            className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
            rows={3}
            value={section.body}
            onChange={(e) =>
              setSections((prev) => prev.map((item, i) => (i === index ? { ...item, body: e.target.value } : item)))
            }
            required
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={saving || !valid}
        className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
      >
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
