export enum UserRole {
  CARER = 'CARER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
  GUARDIAN = 'GUARDIAN',
}

export enum VisitStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  INCOMPLETE = 'INCOMPLETE',
  LATE = 'LATE',
}

export enum MedicationEventStatus {
  ADMINISTERED = 'ADMINISTERED',
  OMITTED = 'OMITTED',
}

export enum NoteType {
  GENERAL = 'GENERAL',
  INCIDENT = 'INCIDENT',
  HANDOVER = 'HANDOVER',
}

export enum NotePriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

export enum ChecklistFieldType {
  BOOLEAN = 'BOOLEAN',
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  active: boolean;
}

export interface Visit {
  id: string;
  clientId: string;
  client: Client;
  carerId: string;
  carer: {
    id: string;
    name: string;
    email?: string;
  };
  scheduledStart?: string;
  scheduledEnd?: string;
  clockInTime?: string;
  clockOutTime?: string;
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  withinGeofence?: boolean;
  status: VisitStatus;
  medicationEvents?: MedicationEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage?: string | null;
  instructions?: string | null;
  isPrn: boolean;
  currentStock?: number | null;
  reorderThreshold?: number | null;
  active: boolean;
}

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  timeOfDay: string;
  daysOfWeek: string[];
  isPrn?: boolean;
  active: boolean;
}

export interface MedicationEvent {
  id: string;
  medicationId: string;
  scheduleId?: string | null;
  status: MedicationEventStatus;
  note?: string | null;
  reasonCode?: string | null;
  prnIndication?: string | null;
  dosageGiven?: string | null;
  signatureImage?: string | null;
  signedAt?: string | null;
  signedByUserId?: string | null;
  effectivenessNote?: string | null;
  administeredAt: string;
  medication: Medication;
  schedule?: MedicationSchedule | null;
  recordedBy?: {
    id: string;
    name: string;
  };
}

export interface Schedule {
  id: string;
  clientId: string;
  client: Client;
  carerId: string;
  carer: {
    id: string;
    name: string;
    email?: string;
  };
  startTime: string;
  endTime: string;
}

export type ShiftPostingStatus = 'OPEN' | 'FILLED' | 'CANCELLED';
export type ShiftApplicationStatus = 'PENDING' | 'SELECTED' | 'NOT_SELECTED' | 'WITHDRAWN';

export interface ShiftApplication {
  id: string;
  status: ShiftApplicationStatus;
  carer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
}

/** Staff list/detail from GET /v1/manager/shift-postings */
export interface ShiftPosting {
  id: string;
  title: string | null;
  status: ShiftPostingStatus;
  slotsNeeded: number;
  startTime: string;
  endTime: string;
  client: { id: string; name: string; address?: string };
  applications: ShiftApplication[];
}

/** Carer list row from GET /v1/carer/open-shifts */
export interface CarerOpenShiftRow {
  id: string;
  title: string | null;
  status: ShiftPostingStatus;
  slotsNeeded: number;
  startTime: string;
  endTime: string;
  client: { id: string; name: string; address?: string };
  selectedCount: number;
  pendingCount: number;
  applicantCount: number;
  myApplicationStatus: ShiftApplicationStatus | null;
  myApplicationId: string | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  clientId?: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  label: string;
  type: ChecklistFieldType;
  required: boolean;
  optionsJson?: string;
}

export interface ChecklistSubmission {
  id: string;
  visitId: string;
  templateId?: string;
  template?: ChecklistTemplate;
  submittedAt: string;
  intervalIndex?: number;
  items: ChecklistSubmissionItem[];
}

export interface ChecklistSubmissionItem {
  id: string;
  submissionId: string;
  checklistItemId?: string;
  checklistItem?: ChecklistItem;
  valueBoolean?: boolean;
  valueText?: string;
  valueNumber?: number;
  valueOption?: string;
}

export interface Note {
  id: string;
  visitId: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    email?: string;
  };
  type: NoteType;
  priority: NotePriority;
  text: string;
  createdAt: string;
}

/** GET /api/visits/:id/care-plan — active structured care plan for visit client. */
export interface VisitCarePlanSection {
  id: string;
  sectionType: string;
  title: string;
  body: string;
}

export interface VisitCarePlanSnapshot {
  client: { id: string; name: string };
  carePlan: {
    id: string;
    status: string;
    reviewDate: string | null;
    currentVersion: {
      version: number;
      summary: string | null;
      sections: VisitCarePlanSection[];
    } | null;
  } | null;
}

