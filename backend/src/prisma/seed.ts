import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  const havenFlowOrg = await prisma.organization.upsert({
    where: { nameNormalized: 'haven flow' },
    update: { code: 'HFL' } as any,
    create: {
      name: 'Haven Flow',
      nameNormalized: 'haven flow',
      code: 'HFL',
    } as any,
  });
  console.log('✅ Created organization');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@havenflow.com' },
    update: { emailVerifiedAt: new Date() },
    create: {
      name: 'Admin User',
      email: 'admin@havenflow.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      organizationId: havenFlowOrg.id,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Created admin user');

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@havenflow.com' },
    update: { emailVerifiedAt: new Date() },
    create: {
      name: 'Manager User',
      email: 'manager@havenflow.com',
      passwordHash: managerPassword,
      role: UserRole.MANAGER,
      organizationId: havenFlowOrg.id,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Created manager user');

  // Create carer users
  const carerPassword = await bcrypt.hash('carer123', 10);
  const carer1 = await prisma.user.upsert({
    where: { email: 'carer1@havenflow.com' },
    update: { emailVerifiedAt: new Date() },
    create: {
      name: 'John Carer',
      email: 'carer1@havenflow.com',
      phone: '+441234567890',
      passwordHash: carerPassword,
      role: UserRole.CARER,
      organizationId: havenFlowOrg.id,
      emailVerifiedAt: new Date(),
    },
  });

  const carer2 = await prisma.user.upsert({
    where: { email: 'carer2@havenflow.com' },
    update: { emailVerifiedAt: new Date() },
    create: {
      name: 'Jane Carer',
      email: 'carer2@havenflow.com',
      phone: '+441234567891',
      passwordHash: carerPassword,
      role: UserRole.CARER,
      organizationId: havenFlowOrg.id,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Created carer users');

  // Create clients
  const client1 = await prisma.client.upsert({
    where: { id: 'client-1' },
    update: {
      name: 'Malachi Bartolomeu',
      address: 'Flat 1 Garret House, Brunner Road, London',
      latitude: 51.5072,
      longitude: -0.1276,
      geofenceRadiusMeters: 150,
      contactName: 'Parent/Guardian',
      contactPhone: '07412177589',
      notes: 'Paediatric complex care profile.',
      profile: {
        personal: {
          preferredName: 'Malachi',
          dateOfBirth: '2015-06-21',
          gender: 'Male',
          genderAtBirth: 'Male',
          pronouns: 'He',
          ethnicity: 'African/British',
          religion: 'Christian',
        },
        contactAndEmergency: {
          primaryPhone: '07412177589',
          email: 'operations@dhamaltd.org',
          communicationPreference: 'Trusted Person',
          emergencyRating: 'MEDIUM',
          familyContacts: [
            {
              name: 'Mum',
              role: 'Primary Guardian',
              mobile: '07412177589',
              isEmergencyContact: true,
            },
          ],
        },
        clinicalSummary: {
          dnarOrRespectStatus: 'Resuscitate',
          medicalHistory: [
            'Born prematurely at 35+2 weeks',
            'Quadriplegic Cerebral Palsy',
            'Global developmental delay',
            'Severe visual impairment',
          ],
          healthTags: ['Paediatric - Complex Medical Needs'],
          heightMeters: 1.4,
          weightKg: 32.2,
          bmi: 16.43,
          oxygenRequired: false,
          catheterInUse: false,
          nilByMouth: true,
        },
        allergiesAndAlerts: {
          foodAllergies: [],
          medicationAllergies: [],
          riskAlerts: ['Aspiration risk'],
        },
        careTeamAndDecisionMakers: {
          involvedProfessionals: ['Dietician', 'Physio', 'Social Worker'],
          decisionMakers: [
            {
              name: 'Parent/Guardian',
              role: 'Best Interest Decision Maker',
            },
          ],
        },
        nutritionAndHydration: {
          mainDiet: 'Peptamen Junior Advance 1.5kcal/ml',
          specialDiets: ['Nutritional Supplement'],
          feedingRoute: 'PEG',
          feedingPlan: [
            {
              name: 'Breakfast feed',
              time: '05:45',
              frequency: 'Rota Days',
              instructions: '100ml via Flocare pump at 100ml/hr',
              assignedTeam: ['All'],
            },
          ],
          hydrationPlan: [
            {
              name: 'Bolus water',
              time: '09:00',
              frequency: 'Daily',
              instructions: '100ml via push',
              assignedTeam: ['All'],
            },
          ],
        },
        medicationSupport: {
          selfManaged: false,
          supportLevel: 'Full support',
          supportNeeds: [
            'Administer feeds and flushes',
            'Support PEG site care',
          ],
          currentMedications: [
            {
              name: 'Dioralyte',
              purpose: 'Hydration support',
              schedule: 'Overnight as per plan',
              route: 'PEG',
            },
          ],
        },
        dailyLivingAndMobility: {
          mobilitySupport: 'Full support for transfers and positioning',
          equipment: ['Wheelchair', 'Standing Frame', 'Gantry Hoist'],
          continenceSupport: 'Nappy checks and changes',
          oralCareSupport: 'Twice daily brushing with minimal toothpaste',
          positioningPlan: [
            {
              name: 'Reposition and comfort check',
              time: '05:00',
              frequency: 'Daily',
              instructions: 'Check skin comfort and heel pads',
              assignedTeam: ['All'],
            },
          ],
        },
        monitoringAndObservations: {
          vitalsSchedule: [
            {
              vitalName: 'Oxygen Saturation',
              frequency: 'Daily',
              time: '23:45',
            },
            {
              vitalName: 'Heart Rate',
              frequency: 'Daily',
              time: '23:45',
            },
          ],
          observationInstructions: 'Record all interventions in hourly notes.',
        },
        schedulesAndShiftTasks: {
          dailyTasks: [
            {
              name: 'Hourly summary notes',
              time: '00:00',
              frequency: 'Rota Days',
              instructions: 'Document observations and interventions.',
              assignedTeam: ['All'],
            },
          ],
          shiftHandoverRequirements:
            'Document handover at start and end of shift.',
          startShiftChecks: [
            'Medication',
            'Feed pump',
            'Suction machine',
            'Supplies for next 3 shifts',
          ],
          endShiftChecks: [
            'Clean used equipment',
            'Tidy environment',
            'Complete concern log',
          ],
          hourlyLoggingRequired: true,
        },
        equipmentAndEnvironment: {
          requiredEquipment: [
            'Feed pump',
            'Suction machine',
            'Standing frame',
            'Wheelchair',
          ],
          environmentRequirements: [
            'Keep room and bathroom clean',
            'Keep equipment organised',
          ],
        },
        personCentredInfoAndOutcomes: {
          history: 'Complex paediatric care background.',
          routines: 'Consistent routine is important.',
          triggers: ['Unexpected changes in routine'],
          calmingStrategies: ['Reassurance', 'Familiar carers'],
          likes: ['Structured routine'],
          hobbies: [],
          desiredOutcomes: [
            'Comfort and safety',
            'Stable hydration and nutrition',
          ],
        },
        reviewAndAudit: {
          carePlanStartDate: '2014-06-04',
          wentLiveOn: '2024-07-17T13:15:00Z',
          lastReviewedAt: '2026-04-10T09:00:00Z',
          reviewedBy: 'Admin',
        },
      },
    },
    create: {
      id: 'client-1',
      organizationId: havenFlowOrg.id,
      name: 'Malachi Bartolomeu',
      address: 'Flat 1 Garret House, Brunner Road, London',
      latitude: 51.5072,
      longitude: -0.1276,
      geofenceRadiusMeters: 150,
      contactName: 'Parent/Guardian',
      contactPhone: '07412177589',
      notes: 'Paediatric complex care profile.',
      profile: {
        personal: {
          preferredName: 'Malachi',
          dateOfBirth: '2015-06-21',
          gender: 'Male',
          genderAtBirth: 'Male',
          pronouns: 'He',
          ethnicity: 'African/British',
          religion: 'Christian',
        },
      },
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'client-2' },
    update: {
      name: 'Robert Johnson',
      address: '456 Support Avenue, London, SW1A 2BB',
      latitude: 51.508,
      longitude: -0.128,
      geofenceRadiusMeters: 150,
      contactName: 'Mary Johnson',
      contactPhone: '+441234567893',
      notes: 'Updated feeding and monitoring instructions.',
      profile: {
        nutritionAndHydration: {
          feedingPlan: [
            {
              name: 'Dinner feed',
              time: '20:00',
              frequency: 'Rota Days',
              instructions:
                '100ml via Flocare pump at 100ml/hr with 25ml flush',
              assignedTeam: ['All'],
            },
          ],
        },
        monitoringAndObservations: {
          vitalsSchedule: [
            {
              vitalName: 'Temperature Check',
              frequency: 'Daily',
              time: '18:15',
            },
          ],
        },
        reviewAndAudit: {
          lastReviewedAt: '2026-04-10T09:00:00Z',
          reviewedBy: 'Admin',
        },
      },
    },
    create: {
      id: 'client-2',
      organizationId: havenFlowOrg.id,
      name: 'Robert Johnson',
      address: '456 Support Avenue, London, SW1A 2BB',
      latitude: 51.5080,
      longitude: -0.1280,
      geofenceRadiusMeters: 150,
      contactName: 'Mary Johnson',
      contactPhone: '+441234567893',
      notes: 'Updated feeding and monitoring instructions.',
      profile: {
        monitoringAndObservations: {
          vitalsSchedule: [
            {
              vitalName: 'Temperature Check',
              frequency: 'Daily',
              time: '18:15',
            },
          ],
        },
      },
    },
  });
  console.log('✅ Created clients');

  // Carers must record availability before schedules can be booked
  const availabilityDayStart = new Date();
  availabilityDayStart.setDate(availabilityDayStart.getDate() + 1);
  availabilityDayStart.setHours(0, 0, 0, 0);
  const availabilityDayEnd = new Date(availabilityDayStart);
  availabilityDayEnd.setHours(23, 59, 59, 999);

  await prisma.availability.createMany({
    data: [
      {
        carerId: carer1.id,
        startTime: availabilityDayStart,
        endTime: availabilityDayEnd,
        isAvailable: true,
      },
      {
        carerId: carer2.id,
        startTime: availabilityDayStart,
        endTime: availabilityDayEnd,
        isAvailable: true,
      },
    ],
  });
  console.log('✅ Created carer availability for seeded day');

  // Create checklist template
  const template = await prisma.checklistTemplate.create({
    data: {
      organizationId: havenFlowOrg.id,
      name: 'Standard Care Checklist',
      description: 'Daily care checklist for clients',
      clientId: client1.id,
      items: {
        create: [
          {
            label: 'Medication given',
            type: 'BOOLEAN',
            required: true,
          },
          {
            label: 'Meal provided',
            type: 'BOOLEAN',
            required: true,
          },
          {
            label: 'Hydration level',
            type: 'SELECT',
            required: false,
            optionsJson: JSON.stringify(['Good', 'Fair', 'Poor']),
          },
          {
            label: 'Mood/Wellbeing',
            type: 'SELECT',
            required: false,
            optionsJson: JSON.stringify(['Happy', 'Neutral', 'Sad', 'Anxious']),
          },
          {
            label: 'Notes',
            type: 'TEXT',
            required: false,
          },
        ],
      },
    },
  });
  console.log('✅ Created checklist template');

  // Create schedules
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const schedule1 = await prisma.schedule.create({
    data: {
      clientId: client1.id,
      carerId: carer1.id,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000), // 4 hours later
    },
  });

  const schedule2 = await prisma.schedule.create({
    data: {
      clientId: client2.id,
      carerId: carer2.id,
      startTime: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000),
      endTime: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Created schedules');

  // Generate visits from schedules
  await prisma.visit.create({
    data: {
      clientId: schedule1.clientId,
      carerId: schedule1.carerId,
      scheduledStart: schedule1.startTime,
      scheduledEnd: schedule1.endTime,
      status: 'NOT_STARTED',
    },
  });

  await prisma.visit.create({
    data: {
      clientId: schedule2.clientId,
      carerId: schedule2.carerId,
      scheduledStart: schedule2.startTime,
      scheduledEnd: schedule2.endTime,
      status: 'NOT_STARTED',
    },
  });
  console.log('✅ Created visits');

  console.log('\n🎉 Seeding completed!');
  console.log('\nTest credentials:');
  console.log('Admin: admin@havenflow.com / admin123');
  console.log('Manager: manager@havenflow.com / manager123');
  console.log('Carer: carer1@havenflow.com / carer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

