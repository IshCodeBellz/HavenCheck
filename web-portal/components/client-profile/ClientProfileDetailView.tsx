import type { ClientProfile, ContactRow } from '@/lib/clientProfile';
import { emergencyRatingLabel, parseClientProfile } from '@/lib/clientProfile';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value === '' || value == null ? '—' : value;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(200px,280px)_1fr] gap-x-6 gap-y-0.5 py-2.5 border-b border-navy-100 text-sm">
      <div className="font-medium text-navy-900">{label}</div>
      <div className="text-navy-800/90 whitespace-pre-wrap wrap-break-word">{display}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-navy-900 uppercase tracking-wide mt-8 mb-2">{children}</h3>;
}

function formatBool(v: boolean | undefined): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '—';
}

function joinList(items: string[] | undefined, sep = ', '): React.ReactNode {
  if (!items?.length) return null;
  return items.join(sep);
}

function ageFromDob(dob: string | undefined): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 0 || age > 130) return null;
  return `${age} yrs`;
}

function ContactsTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: ContactRow[];
  kind: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-navy-800/80 mb-2">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-navy-100">
        <table className="min-w-full text-sm">
          <thead className="bg-navy-50 text-left text-xs font-medium text-navy-800">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role ({kind})</th>
              <th className="px-3 py-2">Mobile</th>
              <th className="px-3 py-2">Work</th>
              <th className="px-3 py-2">Home</th>
              <th className="px-3 py-2">Emergency?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((r, i) => (
              <tr key={`${kind}-${i}`} className="text-navy-800">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.role ?? '—'}</td>
                <td className="px-3 py-2">{r.mobile ?? '—'}</td>
                <td className="px-3 py-2">{r.work ?? '—'}</td>
                <td className="px-3 py-2">{r.home ?? '—'}</td>
                <td className="px-3 py-2">{r.isEmergencyContact ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type ClientDetailModel = {
  id: string;
  name: string;
  address: string;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  active?: boolean;
  profile?: unknown;
};

export default function ClientProfileDetailView({ client }: { client: ClientDetailModel }) {
  const profile = parseClientProfile(client.profile);
  const per = profile.personal;
  const ce = profile.contactAndEmergency;
  const clin = profile.clinicalSummary;
  const allergies = profile.allergiesAndAlerts;
  const team = profile.careTeamAndDecisionMakers;
  const nut = profile.nutritionAndHydration;
  const review = profile.reviewAndAudit;

  const telephone = ce?.primaryPhone || client.contactPhone || '—';
  const mobile = ce?.mobile;
  const email = ce?.email;
  const dobLine =
    per?.dateOfBirth != null && per.dateOfBirth !== ''
      ? `${per.dateOfBirth}${ageFromDob(per.dateOfBirth) ? ` (${ageFromDob(per.dateOfBirth)})` : ''}`
      : null;

  const bmiDisplay = (() => {
    if (clin?.bmi != null) return String(clin.bmi);
    if (clin?.heightMeters && clin?.weightKg) {
      const b = clin.weightKg / (clin.heightMeters * clin.heightMeters);
      return b.toFixed(2);
    }
    return null;
  })();

  const statusLabel = client.active === false ? 'Inactive' : 'Live';

  return (
    <div className="rounded-2xl border border-navy-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-navy-100 bg-navy-50/50">
        <p className="text-xs font-medium text-navy-800/70">Service user</p>
        <p className="text-lg font-semibold text-navy-900">{client.name}</p>
      </div>

      <div className="px-5 pb-6">
        <SectionTitle>Basic information & contact</SectionTitle>
        <Row label="Address" value={client.address} />
        <Row label="Telephone" value={telephone} />
        <Row label="Mobile" value={mobile} />
        <Row label="Email" value={email} />
        <Row label="Preferred name" value={per?.preferredName} />
        <Row label="Date of birth" value={dobLine} />
        <Row label="Gender" value={per?.gender} />
        <Row label="Gender at birth" value={per?.genderAtBirth} />
        <Row label="Pronoun" value={per?.pronouns} />
        <Row label="DNAR / RESPECT" value={clin?.dnarOrRespectStatus} />
        <Row label="Sexuality" value={per?.sexuality} />
        <Row label="Start date (care plan)" value={review?.carePlanStartDate} />
        <Row label="Care plan last went live on" value={review?.wentLiveOn} />
        <Row label="Food allergies" value={joinList(allergies?.foodAllergies)} />
        <Row label="Medicine allergies" value={joinList(allergies?.medicationAllergies)} />
        <Row label="Health tags" value={joinList(clin?.healthTags)} />
        <Row label="Status" value={statusLabel} />
        {client.contactName ? <Row label="Legacy contact name" value={client.contactName} /> : null}
        {client.notes ? <Row label="Notes" value={client.notes} /> : null}

        <SectionTitle>Family, GP & emergency contacts</SectionTitle>
        <ContactsTable title="Emergency contacts" rows={ce?.emergencyContacts ?? []} kind="Emergency" />
        <ContactsTable title="Family" rows={ce?.familyContacts ?? []} kind="Family" />
        <ContactsTable title="GP & clinical" rows={ce?.gpContacts ?? []} kind="GP" />
        {!ce?.emergencyContacts?.length && !ce?.familyContacts?.length && !ce?.gpContacts?.length ? (
          <p className="text-sm text-navy-800/60 mt-2">No contacts recorded.</p>
        ) : null}

        <SectionTitle>Health & nutrition</SectionTitle>
        <Row label="Height (m)" value={clin?.heightMeters != null ? String(clin.heightMeters) : null} />
        <Row label="Weight (kg)" value={clin?.weightKg != null ? String(clin.weightKg) : null} />
        <Row label="BMI (kg/m²)" value={bmiDisplay} />
        <Row label="Main diet" value={nut?.mainDiet} />
        <Row label="Nil by mouth" value={formatBool(clin?.nilByMouth)} />
        <Row label="Special diets" value={joinList(nut?.specialDiets)} />
        <Row label="Feeding route" value={nut?.feedingRoute} />
        <Row label="On catheter" value={formatBool(clin?.catheterInUse)} />
        <Row label="Team involvement" value={joinList(team?.involvedProfessionals)} />
        <Row label="Oxygen" value={formatBool(clin?.oxygenRequired)} />

        <SectionTitle>Medical history</SectionTitle>
        {clin?.medicalHistory?.length ? (
          <ul className="list-disc pl-5 text-sm text-navy-800 space-y-1 mt-2">
            {clin.medicalHistory.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-navy-800/60">No medical history lines recorded.</p>
        )}
        {clin?.diagnoses?.length ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-navy-800/80 mb-1">Diagnoses / conditions (tags)</p>
            <ul className="list-disc pl-5 text-sm text-navy-800 space-y-1">
              {clin.diagnoses.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <SectionTitle>Background</SectionTitle>
        <Row label="Marital status" value={per?.maritalStatus} />
        <Row label="Religion" value={per?.religion} />
        <Row label="Ethnicity" value={per?.ethnicity} />
        <Row label="Communication preference" value={ce?.communicationPreference} />
        <Row label="Emergency rating" value={emergencyRatingLabel(ce?.emergencyRating)} />
        <Row label="Telephone" value={telephone} />
        <Row label="Mobile" value={mobile} />

        {review?.adminNotes || review?.lastReviewedAt ? (
          <>
            <SectionTitle>Review & admin</SectionTitle>
            <Row label="Last reviewed" value={review?.lastReviewedAt} />
            <Row label="Next review due" value={review?.nextReviewDueAt} />
            <Row label="Reviewed by" value={review?.reviewedBy} />
            <Row label="Admin notes" value={review?.adminNotes} />
          </>
        ) : null}
      </div>
    </div>
  );
}
