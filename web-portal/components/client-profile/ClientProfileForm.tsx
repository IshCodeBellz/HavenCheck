'use client';

import type { ClientProfile, ContactRow } from '@/lib/clientProfile';
import { listToMultiline, multilineToList } from '@/lib/clientProfile';

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-navy-800">{label}</label>
      {hint ? <p className="text-xs text-navy-600">{hint}</p> : null}
      {children}
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-navy-200 rounded-md focus:outline-none focus:ring-navy-600 focus:border-navy-600 text-navy-900 text-sm';

function ContactBlock({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: ContactRow[];
  onChange: (next: ContactRow[]) => void;
}) {
  const updateRow = (i: number, patch: Partial<ContactRow>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  const add = () => onChange([...rows, { name: '' }]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-3 rounded-lg border border-navy-100 p-4 bg-navy-50/40">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-navy-900">{title}</h4>
        <button type="button" onClick={add} className="text-sm font-medium text-navy-600 hover:underline">
          + Add row
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-navy-600">No rows yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-md border border-navy-100 bg-white p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Name *"
                  value={r.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Role"
                  value={r.role ?? ''}
                  onChange={(e) => updateRow(i, { role: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Mobile"
                  value={r.mobile ?? ''}
                  onChange={(e) => updateRow(i, { mobile: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Work"
                  value={r.work ?? ''}
                  onChange={(e) => updateRow(i, { work: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Home"
                  value={r.home ?? ''}
                  onChange={(e) => updateRow(i, { home: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm text-navy-800">
                  <input
                    type="checkbox"
                    checked={!!r.isEmergencyContact}
                    onChange={(e) => updateRow(i, { isEmergencyContact: e.target.checked })}
                  />
                  Emergency contact
                </label>
              </div>
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-700 hover:underline">
                Remove row
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details
      className="rounded-xl border border-navy-100 bg-white overflow-hidden group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-navy-900 bg-navy-50/60 hover:bg-navy-50 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-navy-500 text-xs group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="p-4 space-y-4 border-t border-navy-100">{children}</div>
    </details>
  );
}

export default function ClientProfileForm({
  value,
  onChange,
}: {
  value: ClientProfile;
  onChange: (next: ClientProfile) => void;
}) {
  const per = value.personal ?? {};
  const ce = value.contactAndEmergency ?? {};
  const clin = value.clinicalSummary ?? {};
  const allergies = value.allergiesAndAlerts ?? {};
  const team = value.careTeamAndDecisionMakers ?? {};
  const nut = value.nutritionAndHydration ?? {};
  const review = value.reviewAndAudit ?? {};

  const setPersonal = (patch: Partial<NonNullable<ClientProfile['personal']>>) =>
    onChange({ ...value, personal: { ...per, ...patch } });

  const setCe = (patch: Partial<NonNullable<ClientProfile['contactAndEmergency']>>) =>
    onChange({ ...value, contactAndEmergency: { ...ce, ...patch } });

  const setClin = (patch: Partial<NonNullable<ClientProfile['clinicalSummary']>>) =>
    onChange({ ...value, clinicalSummary: { ...clin, ...patch } });

  const setAllergies = (patch: Partial<NonNullable<ClientProfile['allergiesAndAlerts']>>) =>
    onChange({ ...value, allergiesAndAlerts: { ...allergies, ...patch } });

  const setTeam = (patch: Partial<NonNullable<ClientProfile['careTeamAndDecisionMakers']>>) =>
    onChange({ ...value, careTeamAndDecisionMakers: { ...team, ...patch } });

  const setNut = (patch: Partial<NonNullable<ClientProfile['nutritionAndHydration']>>) =>
    onChange({ ...value, nutritionAndHydration: { ...nut, ...patch } });

  const setReview = (patch: Partial<NonNullable<ClientProfile['reviewAndAudit']>>) =>
    onChange({ ...value, reviewAndAudit: { ...review, ...patch } });

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-700">
        Extended care profile stored with the client record. Fields match the structured profile used on the admin
        detail page.
      </p>

      <DetailsSection title="Personal & background" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Preferred name">
            <input className={inputClass} value={per.preferredName ?? ''} onChange={(e) => setPersonal({ preferredName: e.target.value })} />
          </Field>
          <Field label="Date of birth" hint="ISO (YYYY-MM-DD) or text shown as entered">
            <input className={inputClass} value={per.dateOfBirth ?? ''} onChange={(e) => setPersonal({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Gender">
            <input className={inputClass} value={per.gender ?? ''} onChange={(e) => setPersonal({ gender: e.target.value })} />
          </Field>
          <Field label="Gender at birth">
            <input className={inputClass} value={per.genderAtBirth ?? ''} onChange={(e) => setPersonal({ genderAtBirth: e.target.value })} />
          </Field>
          <Field label="Pronouns">
            <input className={inputClass} value={per.pronouns ?? ''} onChange={(e) => setPersonal({ pronouns: e.target.value })} />
          </Field>
          <Field label="Sexuality">
            <input className={inputClass} value={per.sexuality ?? ''} onChange={(e) => setPersonal({ sexuality: e.target.value })} />
          </Field>
          <Field label="Ethnicity">
            <input className={inputClass} value={per.ethnicity ?? ''} onChange={(e) => setPersonal({ ethnicity: e.target.value })} />
          </Field>
          <Field label="Religion">
            <input className={inputClass} value={per.religion ?? ''} onChange={(e) => setPersonal({ religion: e.target.value })} />
          </Field>
          <Field label="Marital status">
            <input className={inputClass} value={per.maritalStatus ?? ''} onChange={(e) => setPersonal({ maritalStatus: e.target.value })} />
          </Field>
        </div>
      </DetailsSection>

      <DetailsSection title="Contact & emergency" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary telephone (profile)">
            <input className={inputClass} value={ce.primaryPhone ?? ''} onChange={(e) => setCe({ primaryPhone: e.target.value })} />
          </Field>
          <Field label="Mobile">
            <input className={inputClass} value={ce.mobile ?? ''} onChange={(e) => setCe({ mobile: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={ce.email ?? ''} onChange={(e) => setCe({ email: e.target.value })} />
          </Field>
          <Field label="Communication preference">
            <input
              className={inputClass}
              value={ce.communicationPreference ?? ''}
              onChange={(e) => setCe({ communicationPreference: e.target.value })}
            />
          </Field>
          <Field label="Emergency rating">
            <select
              className={inputClass}
              value={ce.emergencyRating ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setCe({
                  emergencyRating: v === '' ? undefined : (v as 'LOW' | 'MEDIUM' | 'HIGH'),
                });
              }}
            >
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </Field>
        </div>
        <ContactBlock title="Emergency contacts" rows={ce.emergencyContacts ?? []} onChange={(rows) => setCe({ emergencyContacts: rows })} />
        <ContactBlock title="Family contacts" rows={ce.familyContacts ?? []} onChange={(rows) => setCe({ familyContacts: rows })} />
        <ContactBlock title="GP / doctor contacts" rows={ce.gpContacts ?? []} onChange={(rows) => setCe({ gpContacts: rows })} />
      </DetailsSection>

      <DetailsSection title="Clinical summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="DNAR / RESPECT">
            <input
              className={inputClass}
              value={clin.dnarOrRespectStatus ?? ''}
              onChange={(e) => setClin({ dnarOrRespectStatus: e.target.value })}
            />
          </Field>
          <Field label="Health tags" hint="One per line">
            <textarea
              className={inputClass}
              rows={3}
              value={listToMultiline(clin.healthTags)}
              onChange={(e) => setClin({ healthTags: multilineToList(e.target.value) })}
            />
          </Field>
          <Field label="Height (m)">
            <input
              className={inputClass}
              type="number"
              step="0.01"
              value={clin.heightMeters ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') setClin({ heightMeters: undefined });
                else {
                  const n = parseFloat(v);
                  setClin({ heightMeters: Number.isFinite(n) ? n : undefined });
                }
              }}
            />
          </Field>
          <Field label="Weight (kg)">
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={clin.weightKg ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') setClin({ weightKg: undefined });
                else {
                  const n = parseFloat(v);
                  setClin({ weightKg: Number.isFinite(n) ? n : undefined });
                }
              }}
            />
          </Field>
          <Field label="BMI (optional — can be derived from height/weight on the detail page)">
            <input
              className={inputClass}
              type="number"
              step="0.01"
              value={clin.bmi ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') setClin({ bmi: undefined });
                else {
                  const n = parseFloat(v);
                  setClin({ bmi: Number.isFinite(n) ? n : undefined });
                }
              }}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input type="checkbox" checked={!!clin.nilByMouth} onChange={(e) => setClin({ nilByMouth: e.target.checked })} />
            Nil by mouth
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input type="checkbox" checked={!!clin.catheterInUse} onChange={(e) => setClin({ catheterInUse: e.target.checked })} />
            Catheter in use
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input type="checkbox" checked={!!clin.oxygenRequired} onChange={(e) => setClin({ oxygenRequired: e.target.checked })} />
            Oxygen required
          </label>
        </div>
        <Field label="Medical history" hint="One bullet per line">
          <textarea
            className={inputClass}
            rows={6}
            value={listToMultiline(clin.medicalHistory)}
            onChange={(e) => setClin({ medicalHistory: multilineToList(e.target.value) })}
          />
        </Field>
        <Field label="Diagnoses / extra lines" hint="One per line">
          <textarea
            className={inputClass}
            rows={3}
            value={listToMultiline(clin.diagnoses)}
            onChange={(e) => setClin({ diagnoses: multilineToList(e.target.value) })}
          />
        </Field>
      </DetailsSection>

      <DetailsSection title="Allergies & alerts">
        <Field label="Food allergies" hint="One per line">
          <textarea
            className={inputClass}
            rows={3}
            value={listToMultiline(allergies.foodAllergies)}
            onChange={(e) => setAllergies({ foodAllergies: multilineToList(e.target.value) })}
          />
        </Field>
        <Field label="Medication allergies" hint="One per line">
          <textarea
            className={inputClass}
            rows={3}
            value={listToMultiline(allergies.medicationAllergies)}
            onChange={(e) => setAllergies({ medicationAllergies: multilineToList(e.target.value) })}
          />
        </Field>
        <Field label="Risk alerts" hint="One per line">
          <textarea
            className={inputClass}
            rows={2}
            value={listToMultiline(allergies.riskAlerts)}
            onChange={(e) => setAllergies({ riskAlerts: multilineToList(e.target.value) })}
          />
        </Field>
      </DetailsSection>

      <DetailsSection title="Nutrition">
        <Field label="Main diet">
          <input className={inputClass} value={nut.mainDiet ?? ''} onChange={(e) => setNut({ mainDiet: e.target.value })} />
        </Field>
        <Field label="Special diets" hint="One per line">
          <textarea
            className={inputClass}
            rows={3}
            value={listToMultiline(nut.specialDiets)}
            onChange={(e) => setNut({ specialDiets: multilineToList(e.target.value) })}
          />
        </Field>
        <Field label="Feeding route (e.g. PEG)">
          <input className={inputClass} value={nut.feedingRoute ?? ''} onChange={(e) => setNut({ feedingRoute: e.target.value })} />
        </Field>
      </DetailsSection>

      <DetailsSection title="Care team">
        <Field label="Involved professionals" hint="Comma optional — one per line">
          <textarea
            className={inputClass}
            rows={3}
            value={listToMultiline(team.involvedProfessionals)}
            onChange={(e) => setTeam({ involvedProfessionals: multilineToList(e.target.value) })}
          />
        </Field>
      </DetailsSection>

      <DetailsSection title="Care plan dates & admin">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Care plan start date">
            <input className={inputClass} value={review.carePlanStartDate ?? ''} onChange={(e) => setReview({ carePlanStartDate: e.target.value })} />
          </Field>
          <Field label="Went live on">
            <input className={inputClass} value={review.wentLiveOn ?? ''} onChange={(e) => setReview({ wentLiveOn: e.target.value })} />
          </Field>
          <Field label="Last reviewed">
            <input className={inputClass} value={review.lastReviewedAt ?? ''} onChange={(e) => setReview({ lastReviewedAt: e.target.value })} />
          </Field>
          <Field label="Next review due">
            <input className={inputClass} value={review.nextReviewDueAt ?? ''} onChange={(e) => setReview({ nextReviewDueAt: e.target.value })} />
          </Field>
          <Field label="Reviewed by">
            <input className={inputClass} value={review.reviewedBy ?? ''} onChange={(e) => setReview({ reviewedBy: e.target.value })} />
          </Field>
        </div>
        <Field label="Admin notes">
          <textarea className={inputClass} rows={3} value={review.adminNotes ?? ''} onChange={(e) => setReview({ adminNotes: e.target.value })} />
        </Field>
      </DetailsSection>
    </div>
  );
}
