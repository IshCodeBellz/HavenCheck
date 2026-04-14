/** Mirrors backend `clientProfileSchema` shape for portal UI (loose parsing from JSON). */

export type ContactRow = {
  name: string;
  role?: string;
  mobile?: string;
  work?: string;
  home?: string;
  isEmergencyContact?: boolean;
};

export interface ClientProfile {
  personal?: {
    preferredName?: string;
    dateOfBirth?: string;
    gender?: string;
    genderAtBirth?: string;
    pronouns?: string;
    sexuality?: string;
    ethnicity?: string;
    religion?: string;
    maritalStatus?: string;
  };
  contactAndEmergency?: {
    primaryPhone?: string;
    mobile?: string;
    email?: string;
    communicationPreference?: string;
    emergencyRating?: 'LOW' | 'MEDIUM' | 'HIGH';
    emergencyContacts?: ContactRow[];
    gpContacts?: ContactRow[];
    familyContacts?: ContactRow[];
  };
  clinicalSummary?: {
    dnarOrRespectStatus?: string;
    medicalHistory?: string[];
    diagnoses?: string[];
    healthTags?: string[];
    heightMeters?: number;
    weightKg?: number;
    bmi?: number;
    oxygenRequired?: boolean;
    catheterInUse?: boolean;
    nilByMouth?: boolean;
  };
  allergiesAndAlerts?: {
    foodAllergies?: string[];
    medicationAllergies?: string[];
    riskAlerts?: string[];
  };
  careTeamAndDecisionMakers?: {
    involvedProfessionals?: string[];
    keyWorkers?: ContactRow[];
    decisionMakers?: ContactRow[];
  };
  nutritionAndHydration?: {
    mainDiet?: string;
    specialDiets?: string[];
    feedingRoute?: string;
    feedingPlan?: unknown[];
    hydrationPlan?: unknown[];
  };
  reviewAndAudit?: {
    carePlanStartDate?: string;
    wentLiveOn?: string;
    lastReviewedAt?: string;
    nextReviewDueAt?: string;
    reviewedBy?: string;
    adminNotes?: string;
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asContactRows(v: unknown): ContactRow[] {
  if (!Array.isArray(v)) return [];
  const out: ContactRow[] = [];
  for (const row of v) {
    const r = asRecord(row);
    if (!r || typeof r.name !== 'string' || !r.name.trim()) continue;
    out.push({
      name: r.name,
      role: typeof r.role === 'string' ? r.role : undefined,
      mobile: typeof r.mobile === 'string' ? r.mobile : undefined,
      work: typeof r.work === 'string' ? r.work : undefined,
      home: typeof r.home === 'string' ? r.home : undefined,
      isEmergencyContact: typeof r.isEmergencyContact === 'boolean' ? r.isEmergencyContact : undefined,
    });
  }
  return out;
}

export function parseClientProfile(raw: unknown): ClientProfile {
  const root = asRecord(raw);
  if (!root) return {};

  const personal = asRecord(root.personal);
  const contactAndEmergency = asRecord(root.contactAndEmergency);
  const clinical = asRecord(root.clinicalSummary);
  const allergies = asRecord(root.allergiesAndAlerts);
  const careTeam = asRecord(root.careTeamAndDecisionMakers);
  const nutrition = asRecord(root.nutritionAndHydration);
  const review = asRecord(root.reviewAndAudit);

  const profile: ClientProfile = {};

  if (personal) {
    profile.personal = {
      preferredName: typeof personal.preferredName === 'string' ? personal.preferredName : undefined,
      dateOfBirth: typeof personal.dateOfBirth === 'string' ? personal.dateOfBirth : undefined,
      gender: typeof personal.gender === 'string' ? personal.gender : undefined,
      genderAtBirth: typeof personal.genderAtBirth === 'string' ? personal.genderAtBirth : undefined,
      pronouns: typeof personal.pronouns === 'string' ? personal.pronouns : undefined,
      sexuality: typeof personal.sexuality === 'string' ? personal.sexuality : undefined,
      ethnicity: typeof personal.ethnicity === 'string' ? personal.ethnicity : undefined,
      religion: typeof personal.religion === 'string' ? personal.religion : undefined,
      maritalStatus: typeof personal.maritalStatus === 'string' ? personal.maritalStatus : undefined,
    };
  }

  if (contactAndEmergency) {
    const er = contactAndEmergency.emergencyRating;
    profile.contactAndEmergency = {
      primaryPhone: typeof contactAndEmergency.primaryPhone === 'string' ? contactAndEmergency.primaryPhone : undefined,
      mobile: typeof contactAndEmergency.mobile === 'string' ? contactAndEmergency.mobile : undefined,
      email: typeof contactAndEmergency.email === 'string' ? contactAndEmergency.email : undefined,
      communicationPreference:
        typeof contactAndEmergency.communicationPreference === 'string'
          ? contactAndEmergency.communicationPreference
          : undefined,
      emergencyRating: er === 'LOW' || er === 'MEDIUM' || er === 'HIGH' ? er : undefined,
      emergencyContacts: asContactRows(contactAndEmergency.emergencyContacts),
      gpContacts: asContactRows(contactAndEmergency.gpContacts),
      familyContacts: asContactRows(contactAndEmergency.familyContacts),
    };
  }

  if (clinical) {
    profile.clinicalSummary = {
      dnarOrRespectStatus:
        typeof clinical.dnarOrRespectStatus === 'string' ? clinical.dnarOrRespectStatus : undefined,
      medicalHistory: asStringArray(clinical.medicalHistory),
      diagnoses: asStringArray(clinical.diagnoses),
      healthTags: asStringArray(clinical.healthTags),
      heightMeters: typeof clinical.heightMeters === 'number' ? clinical.heightMeters : undefined,
      weightKg: typeof clinical.weightKg === 'number' ? clinical.weightKg : undefined,
      bmi: typeof clinical.bmi === 'number' ? clinical.bmi : undefined,
      oxygenRequired: typeof clinical.oxygenRequired === 'boolean' ? clinical.oxygenRequired : undefined,
      catheterInUse: typeof clinical.catheterInUse === 'boolean' ? clinical.catheterInUse : undefined,
      nilByMouth: typeof clinical.nilByMouth === 'boolean' ? clinical.nilByMouth : undefined,
    };
  }

  if (allergies) {
    profile.allergiesAndAlerts = {
      foodAllergies: asStringArray(allergies.foodAllergies),
      medicationAllergies: asStringArray(allergies.medicationAllergies),
      riskAlerts: asStringArray(allergies.riskAlerts),
    };
  }

  if (careTeam) {
    profile.careTeamAndDecisionMakers = {
      involvedProfessionals: asStringArray(careTeam.involvedProfessionals),
      keyWorkers: asContactRows(careTeam.keyWorkers),
      decisionMakers: asContactRows(careTeam.decisionMakers),
    };
  }

  if (nutrition) {
    profile.nutritionAndHydration = {
      mainDiet: typeof nutrition.mainDiet === 'string' ? nutrition.mainDiet : undefined,
      specialDiets: asStringArray(nutrition.specialDiets),
      feedingRoute: typeof nutrition.feedingRoute === 'string' ? nutrition.feedingRoute : undefined,
    };
  }

  if (review) {
    profile.reviewAndAudit = {
      carePlanStartDate: typeof review.carePlanStartDate === 'string' ? review.carePlanStartDate : undefined,
      wentLiveOn: typeof review.wentLiveOn === 'string' ? review.wentLiveOn : undefined,
      lastReviewedAt: typeof review.lastReviewedAt === 'string' ? review.lastReviewedAt : undefined,
      nextReviewDueAt: typeof review.nextReviewDueAt === 'string' ? review.nextReviewDueAt : undefined,
      reviewedBy: typeof review.reviewedBy === 'string' ? review.reviewedBy : undefined,
      adminNotes: typeof review.adminNotes === 'string' ? review.adminNotes : undefined,
    };
  }

  return profile;
}

function trimContacts(rows: ContactRow[] | undefined): ContactRow[] {
  if (!rows?.length) return [];
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      role: r.role?.trim() || undefined,
      mobile: r.mobile?.trim() || undefined,
      work: r.work?.trim() || undefined,
      home: r.home?.trim() || undefined,
      isEmergencyContact: r.isEmergencyContact,
    }));
}

/** Prepare profile for API: drop empty contact rows, trim strings in lists. */
export function sanitizeProfileForApi(p: ClientProfile): ClientProfile {
  const ce = p.contactAndEmergency;
  const next: ClientProfile = { ...p };
  if (ce) {
    next.contactAndEmergency = {
      ...ce,
      emergencyContacts: trimContacts(ce.emergencyContacts),
      familyContacts: trimContacts(ce.familyContacts),
      gpContacts: trimContacts(ce.gpContacts),
    };
  }
  return next;
}


export function listToMultiline(list: string[] | undefined): string {
  return (list && list.length ? list : []).join('\n');
}

export function multilineToList(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function emergencyRatingLabel(v: 'LOW' | 'MEDIUM' | 'HIGH' | undefined): string {
  if (v === 'LOW') return 'Low';
  if (v === 'MEDIUM') return 'Medium';
  if (v === 'HIGH') return 'High';
  return '';
}
