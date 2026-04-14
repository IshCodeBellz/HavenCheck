import { z } from 'zod';

const stringList = z.array(z.string().min(1)).default([]);

const contactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  mobile: z.string().optional(),
  work: z.string().optional(),
  home: z.string().optional(),
  isEmergencyContact: z.boolean().optional(),
});

const taskScheduleItemSchema = z.object({
  name: z.string().min(1),
  time: z.string().optional(),
  frequency: z.string().optional(),
  instructions: z.string().optional(),
  assignedTeam: stringList,
});

const vitalScheduleItemSchema = z.object({
  vitalName: z.string().min(1),
  frequency: z.string().optional(),
  time: z.string().optional(),
});

export const clientProfileSchema = z.object({
  personal: z.object({
    preferredName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    genderAtBirth: z.string().optional(),
    pronouns: z.string().optional(),
    sexuality: z.string().optional(),
    ethnicity: z.string().optional(),
    religion: z.string().optional(),
    maritalStatus: z.string().optional(),
  }).optional(),

  contactAndEmergency: z.object({
    primaryPhone: z.string().optional(),
    mobile: z.string().optional(),
    email: z.string().optional(),
    communicationPreference: z.string().optional(),
    emergencyRating: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    emergencyContacts: z.array(contactSchema).default([]),
    gpContacts: z.array(contactSchema).default([]),
    familyContacts: z.array(contactSchema).default([]),
  }).optional(),

  clinicalSummary: z.object({
    dnarOrRespectStatus: z.string().optional(),
    medicalHistory: stringList,
    diagnoses: stringList,
    healthTags: stringList,
    heightMeters: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    bmi: z.number().positive().optional(),
    oxygenRequired: z.boolean().optional(),
    catheterInUse: z.boolean().optional(),
    nilByMouth: z.boolean().optional(),
  }).optional(),

  allergiesAndAlerts: z.object({
    foodAllergies: stringList,
    medicationAllergies: stringList,
    riskAlerts: stringList,
  }).optional(),

  careTeamAndDecisionMakers: z.object({
    involvedProfessionals: stringList,
    keyWorkers: z.array(contactSchema).default([]),
    decisionMakers: z.array(contactSchema).default([]),
  }).optional(),

  nutritionAndHydration: z.object({
    mainDiet: z.string().optional(),
    specialDiets: stringList,
    feedingRoute: z.string().optional(),
    feedingPlan: z.array(taskScheduleItemSchema).default([]),
    hydrationPlan: z.array(taskScheduleItemSchema).default([]),
  }).optional(),

  medicationSupport: z.object({
    selfManaged: z.boolean().optional(),
    supportLevel: z.string().optional(),
    supportNeeds: stringList,
    currentMedications: z.array(z.object({
      name: z.string().min(1),
      purpose: z.string().optional(),
      dosage: z.string().optional(),
      schedule: z.string().optional(),
      route: z.string().optional(),
    })).default([]),
  }).optional(),

  dailyLivingAndMobility: z.object({
    mobilitySupport: z.string().optional(),
    equipment: stringList,
    continenceSupport: z.string().optional(),
    skinIntegritySupport: z.string().optional(),
    oralCareSupport: z.string().optional(),
    bathingSupport: z.string().optional(),
    positioningPlan: z.array(taskScheduleItemSchema).default([]),
  }).optional(),

  monitoringAndObservations: z.object({
    vitalsSchedule: z.array(vitalScheduleItemSchema).default([]),
    observationInstructions: z.string().optional(),
    escalationGuidance: z.string().optional(),
  }).optional(),

  schedulesAndShiftTasks: z.object({
    dailyTasks: z.array(taskScheduleItemSchema).default([]),
    shiftHandoverRequirements: z.string().optional(),
    startShiftChecks: stringList,
    endShiftChecks: stringList,
    hourlyLoggingRequired: z.boolean().optional(),
  }).optional(),

  equipmentAndEnvironment: z.object({
    requiredEquipment: stringList,
    environmentRequirements: stringList,
    housekeepingTasks: z.array(taskScheduleItemSchema).default([]),
  }).optional(),

  personCentredInfoAndOutcomes: z.object({
    history: z.string().optional(),
    routines: z.string().optional(),
    triggers: stringList,
    calmingStrategies: stringList,
    likes: stringList,
    dislikes: stringList,
    hobbies: stringList,
    preferredPlaces: stringList,
    communicationPreferences: z.string().optional(),
    emotionalSupportNeeds: z.string().optional(),
    desiredOutcomes: stringList,
  }).optional(),

  reviewAndAudit: z.object({
    carePlanStartDate: z.string().optional(),
    wentLiveOn: z.string().optional(),
    lastReviewedAt: z.string().optional(),
    nextReviewDueAt: z.string().optional(),
    reviewedBy: z.string().optional(),
    adminNotes: z.string().optional(),
  }).optional(),
}).strict();

export const createClientSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  profile: clientProfileSchema.optional(),
}).strict();

export const updateClientSchema = createClientSchema.partial().strict();

export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
