# Haven Flow Backend API

Backend REST API for the Haven Flow Carer App.

**API v1:** See `API_IMPLEMENTATION.md` for `/api/v1/*` routes. This README lists legacy `/api/*` paths that the web portal and mobile app still use via the shared `/api` base URL.

## Tech Stack

- Node.js + TypeScript
- Express.js
- PostgreSQL + Prisma ORM
- JWT Authentication
- bcryptjs for password hashing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT secret
```

3. Set up database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

4. Start development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## Seeded Demo Access

After running `npm run prisma:seed`, you can log in with:

- Admin: `admin@havenflow.com` / `admin123`
- Manager: `manager@havenflow.com` / `manager123`
- Carer: `carer1@havenflow.com` / `carer123`

## Seeded Demo Data Snapshot

The default seed creates:

- Organization: `Haven Flow`
- Carers: `John Carer` and `Jane Carer`
- Clients:
  - `Malachi Bartolomeu` (paediatric complex care profile with structured `profile` JSON)
  - `Robert Johnson` (monitoring + nutrition profile sections)
- Next-day availability for both carers
- Two schedules and matching visits for the next day
- One checklist template: `Standard Care Checklist`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin/Manager)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (Admin)
- `PATCH /api/users/:id` - Update user

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create client (Admin/Manager)
- `PATCH /api/clients/:id` - Update client (Admin/Manager)
- `DELETE /api/clients/:id` - Delete client (Admin)

#### Admin Client Profile Payload Examples

`POST /api/clients` and `PATCH /api/clients/:id` accept a structured `profile` object.

Create example:
```json
{
  "name": "Malachi Bartolomeu",
  "address": "Flat1 Garret House, Brunner Road, London",
  "latitude": 51.5072,
  "longitude": -0.1276,
  "geofenceRadiusMeters": 150,
  "contactName": "Parent/Guardian",
  "contactPhone": "07412177589",
  "notes": "Paediatric complex care profile.",
  "profile": {
    "personal": {
      "preferredName": "Malachi",
      "dateOfBirth": "2015-06-21",
      "gender": "Male",
      "genderAtBirth": "Male",
      "pronouns": "He",
      "ethnicity": "African/British",
      "religion": "Christian"
    },
    "contactAndEmergency": {
      "primaryPhone": "07412177589",
      "email": "operations@dhamaltd.org",
      "communicationPreference": "Trusted Person",
      "emergencyRating": "MEDIUM",
      "familyContacts": [
        {
          "name": "Mum",
          "role": "Primary Guardian",
          "mobile": "07412177589",
          "isEmergencyContact": true
        }
      ]
    },
    "clinicalSummary": {
      "dnarOrRespectStatus": "Resuscitate",
      "medicalHistory": [
        "Born prematurely at 35+2 weeks",
        "Quadriplegic Cerebral Palsy",
        "Global developmental delay",
        "Severe visual impairment"
      ],
      "healthTags": ["Paediatric - Complex Medical Needs"],
      "heightMeters": 1.4,
      "weightKg": 32.2,
      "bmi": 16.43,
      "oxygenRequired": false,
      "catheterInUse": false,
      "nilByMouth": true
    },
    "allergiesAndAlerts": {
      "foodAllergies": [],
      "medicationAllergies": [],
      "riskAlerts": ["Aspiration risk"]
    },
    "careTeamAndDecisionMakers": {
      "involvedProfessionals": ["Dietician", "Physio", "Social Worker"],
      "decisionMakers": [
        {
          "name": "Parent/Guardian",
          "role": "Best Interest Decision Maker"
        }
      ]
    },
    "nutritionAndHydration": {
      "mainDiet": "Peptamen Junior Advance 1.5kcal/ml",
      "specialDiets": ["Nutritional Supplement"],
      "feedingRoute": "PEG",
      "feedingPlan": [
        {
          "name": "Breakfast feed",
          "time": "05:45",
          "frequency": "Rota Days",
          "instructions": "100ml via Flocare pump at 100ml/hr",
          "assignedTeam": ["All"]
        }
      ],
      "hydrationPlan": [
        {
          "name": "Bolus water",
          "time": "09:00",
          "frequency": "Daily",
          "instructions": "100ml via push",
          "assignedTeam": ["All"]
        }
      ]
    },
    "medicationSupport": {
      "selfManaged": false,
      "supportLevel": "Full support",
      "supportNeeds": [
        "Administer feeds and flushes",
        "Support PEG site care"
      ],
      "currentMedications": [
        {
          "name": "Dioralyte",
          "purpose": "Hydration support",
          "schedule": "Overnight as per plan",
          "route": "PEG"
        }
      ]
    },
    "dailyLivingAndMobility": {
      "mobilitySupport": "Full support for transfers and positioning",
      "equipment": ["Wheelchair", "Standing Frame", "Gantry Hoist"],
      "continenceSupport": "Nappy checks and changes",
      "oralCareSupport": "Twice daily brushing with minimal toothpaste",
      "positioningPlan": [
        {
          "name": "Reposition and comfort check",
          "time": "05:00",
          "frequency": "Daily",
          "instructions": "Check skin comfort and heel pads",
          "assignedTeam": ["All"]
        }
      ]
    },
    "monitoringAndObservations": {
      "vitalsSchedule": [
        { "vitalName": "Oxygen Saturation", "frequency": "Daily", "time": "23:45" },
        { "vitalName": "Heart Rate", "frequency": "Daily", "time": "23:45" }
      ],
      "observationInstructions": "Record all interventions in hourly notes."
    },
    "schedulesAndShiftTasks": {
      "dailyTasks": [
        {
          "name": "Hourly summary notes",
          "time": "00:00",
          "frequency": "Rota Days",
          "instructions": "Document observations and interventions.",
          "assignedTeam": ["All"]
        }
      ],
      "shiftHandoverRequirements": "Document handover at start and end of shift.",
      "startShiftChecks": [
        "Medication",
        "Feed pump",
        "Suction machine",
        "Supplies for next 3 shifts"
      ],
      "endShiftChecks": [
        "Clean used equipment",
        "Tidy environment",
        "Complete concern log"
      ],
      "hourlyLoggingRequired": true
    },
    "equipmentAndEnvironment": {
      "requiredEquipment": [
        "Feed pump",
        "Suction machine",
        "Standing frame",
        "Wheelchair"
      ],
      "environmentRequirements": [
        "Keep room and bathroom clean",
        "Keep equipment organised"
      ]
    },
    "personCentredInfoAndOutcomes": {
      "history": "Complex paediatric care background.",
      "routines": "Consistent routine is important.",
      "triggers": ["Unexpected changes in routine"],
      "calmingStrategies": ["Reassurance", "Familiar carers"],
      "likes": ["Structured routine"],
      "hobbies": [],
      "desiredOutcomes": [
        "Comfort and safety",
        "Stable hydration and nutrition"
      ]
    },
    "reviewAndAudit": {
      "carePlanStartDate": "2014-06-04",
      "wentLiveOn": "2024-07-17T13:15:00Z",
      "lastReviewedAt": "2025-10-28T18:27:00Z",
      "reviewedBy": "Admin"
    }
  }
}
```

Update example (partial payload):
```json
{
  "notes": "Updated feeding and monitoring instructions.",
  "profile": {
    "nutritionAndHydration": {
      "feedingPlan": [
        {
          "name": "Dinner feed",
          "time": "20:00",
          "frequency": "Rota Days",
          "instructions": "100ml via Flocare pump at 100ml/hr with 25ml flush",
          "assignedTeam": ["All"]
        }
      ]
    },
    "monitoringAndObservations": {
      "vitalsSchedule": [
        { "vitalName": "Temperature Check", "frequency": "Daily", "time": "18:15" }
      ]
    },
    "reviewAndAudit": {
      "lastReviewedAt": "2026-04-10T09:00:00Z",
      "reviewedBy": "Admin"
    }
  }
}
```

Notes:
- Unknown keys are rejected for client and profile payloads.
- `PATCH /api/clients/:id` is partial, but nested objects are replaced by what you send for that section.
- `POST` and `PATCH` require `ADMIN` or `MANAGER` role.

### Visits
- `GET /api/visits` - Get visits (filtered by role)
- `GET /api/visits/today` - Get today's visits
- `GET /api/visits/:id` - Get visit by ID
- `POST /api/visits/:id/clock-in` - Clock in
- `POST /api/visits/:id/clock-out` - Clock out

### Schedules
- `GET /api/schedules` - Get schedules
- `GET /api/schedules/weekly` - Get weekly rota
- `GET /api/schedules/:id` - Get schedule by ID
- `POST /api/schedules` - Create schedule (Admin/Manager)
- `PATCH /api/schedules/:id` - Update schedule (Admin/Manager)
- `DELETE /api/schedules/:id` - Delete schedule (Admin/Manager)

### Checklists
- `GET /api/checklists/templates` - Get all templates
- `GET /api/checklists/templates/:id` - Get template by ID
- `POST /api/checklists/templates` - Create template (Admin/Manager)
- `POST /api/checklists/visits/:visitId/submit` - Submit checklist
- `GET /api/checklists/visits/:visitId/submissions` - Get submissions

### Notes
- `GET /api/notes/visits/:visitId` - Get notes for visit
- `GET /api/notes/visits/:visitId/handover` - Get handover notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note by ID

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Roles

- **CARER**: Can view and manage their own visits, schedules, checklists, and notes
- **MANAGER**: Can view team data and manage clients, schedules, and templates
- **ADMIN**: Full access to all resources

## Database

Use Prisma Studio to view/edit data:
```bash
npm run prisma:studio
```

