import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { visitsService } from '../../services/visits';
import { Medication, MedicationEventStatus, MedicationSchedule, UserRole, Visit, VisitStatus } from '../../types';
import { format } from 'date-fns';
import { colors } from '../../theme/colors';
import { SignatureCapture } from '../../components/Medication/SignatureCapture';

const VisitDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { visitId } = route.params as { visitId: string };
  const canViewCarePlan =
    user?.role === UserRole.CARER || user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [medications, setMedications] = useState<(Medication & { schedules: MedicationSchedule[] })[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [medEventStatus, setMedEventStatus] = useState<MedicationEventStatus>(MedicationEventStatus.ADMINISTERED);
  const [medReasonCode, setMedReasonCode] = useState('');
  const [medNote, setMedNote] = useState('');
  const [prnIndication, setPrnIndication] = useState('');
  const [prnDosageGiven, setPrnDosageGiven] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [effectivenessNote, setEffectivenessNote] = useState('');

  useEffect(() => {
    loadVisit();
  }, [visitId]);

  const loadVisit = async () => {
    try {
      const [data, meds] = await Promise.all([
        visitsService.getVisitById(visitId),
        visitsService.getDueVisitMedications(visitId),
      ]);
      setVisit(data);
      setMedications(meds);
      if (meds.length > 0) {
        setSelectedMedicationId(meds[0].id);
      }
    } catch (error) {
      console.error('Error loading visit:', error);
      Alert.alert('Error', 'Failed to load visit details');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordMedication = async () => {
    if (!selectedMedicationId) {
      Alert.alert('Missing medication', 'Select a medication first');
      return;
    }
    if (medEventStatus === MedicationEventStatus.OMITTED && !medReasonCode.trim()) {
      Alert.alert('Reason required', 'Provide a reason code when medication is omitted');
      return;
    }
    const selectedMedication = medications.find((m) => m.id === selectedMedicationId);
    if (selectedMedication?.isPrn && medEventStatus === MedicationEventStatus.ADMINISTERED && !prnIndication.trim()) {
      Alert.alert('PRN indication required', 'Provide a PRN indication before recording this medication');
      return;
    }
    if (selectedMedication?.isPrn && medEventStatus === MedicationEventStatus.ADMINISTERED && !prnDosageGiven.trim()) {
      Alert.alert('PRN dosage required', 'Provide the dosage given for this PRN administration');
      return;
    }
    if (medEventStatus === MedicationEventStatus.ADMINISTERED && !signatureName.trim()) {
      Alert.alert('Signature required', 'A signature is required when medication is administered');
      return;
    }

    try {
      setActionLoading(true);
      await visitsService.createMedicationEvent(visitId, {
        medicationId: selectedMedicationId,
        status: medEventStatus,
        reasonCode: medEventStatus === MedicationEventStatus.OMITTED ? medReasonCode.trim() : undefined,
        note: medNote.trim() || undefined,
        prnIndication:
          selectedMedication?.isPrn && medEventStatus === MedicationEventStatus.ADMINISTERED
            ? prnIndication.trim()
            : undefined,
        dosageGiven:
          selectedMedication?.isPrn && medEventStatus === MedicationEventStatus.ADMINISTERED
            ? prnDosageGiven.trim()
            : undefined,
        signatureImage:
          medEventStatus === MedicationEventStatus.ADMINISTERED
            ? `signed://typed/${encodeURIComponent(signatureName.trim())}`
            : undefined,
        effectivenessNote: effectivenessNote.trim() || undefined,
      });

      Alert.alert('Saved', 'Medication event has been recorded');
      setMedNote('');
      setMedReasonCode('');
      setPrnIndication('');
      setPrnDosageGiven('');
      setSignatureName('');
      setEffectivenessNote('');
      const refreshed = await visitsService.getVisitById(visitId);
      setVisit(refreshed);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to record medication event');
    } finally {
      setActionLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to clock in/out');
      return false;
    }
    return true;
  };

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const location = await getCurrentLocation();
      if (!location) {
        setActionLoading(false);
        return;
      }

      // Check if clock-in might be late (more than 15 minutes after scheduled start)
      if (visit?.scheduledStart) {
        const scheduledStart = new Date(visit.scheduledStart);
        const now = new Date();
        const diffMinutes = (now.getTime() - scheduledStart.getTime()) / (1000 * 60);
        
        if (diffMinutes > 15) {
          // Show modal for late reason
          setPendingLocation(location);
          setShowLateReasonModal(true);
          setActionLoading(false);
          return;
        }
      }

      const updatedVisit = await visitsService.clockIn(visitId, location.latitude, location.longitude);
      setVisit(updatedVisit);
      Alert.alert('Success', 'Clocked in successfully');
      setActionLoading(false);
    } catch (error: any) {
      if (error.response?.data?.requiresReason) {
        // Show modal for late reason
        const location = await getCurrentLocation();
        if (location) {
          setPendingLocation(location);
          setShowLateReasonModal(true);
        }
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to clock in');
      }
      setActionLoading(false);
    }
  };

  const handleSubmitLateReason = async () => {
    if (!lateReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for late clock-in');
      return;
    }

    if (!pendingLocation) {
      Alert.alert('Error', 'Location not available');
      setShowLateReasonModal(false);
      return;
    }

    try {
      setActionLoading(true);
      const updatedVisit = await visitsService.clockIn(
        visitId,
        pendingLocation.latitude,
        pendingLocation.longitude,
        lateReason.trim()
      );
      setVisit(updatedVisit);
      setShowLateReasonModal(false);
      setLateReason('');
      setPendingLocation(null);
      Alert.alert('Success', 'Clocked in successfully (marked as late)');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      const location = await getCurrentLocation();
      if (!location) return;

      const updatedVisit = await visitsService.clockOut(visitId, location.latitude, location.longitude);
      setVisit(updatedVisit);
      Alert.alert('Success', 'Clocked out successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={styles.center}>
        <Text>Visit not found</Text>
      </View>
    );
  }

  // Allow late visits to be clocked in; backend will enforce reason rules when needed.
  const canClockIn = visit.status === VisitStatus.NOT_STARTED || visit.status === VisitStatus.LATE;
  // Allow clock out for both IN_PROGRESS and LATE (both are active visits)
  const canClockOut = (visit.status === VisitStatus.IN_PROGRESS || visit.status === VisitStatus.LATE) && visit.clockInTime;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.card}>
        <Text style={styles.clientName}>{visit.client.name}</Text>
        <Text style={styles.address}>{visit.client.address}</Text>
        {canViewCarePlan && (
          <TouchableOpacity
            style={styles.carePlanLink}
            onPress={() =>
              (navigation as unknown as { navigate: (name: string, params?: { visitId: string }) => void }).navigate(
                'CarePlanSummary',
                { visitId }
              )
            }
          >
            <Text style={styles.carePlanLinkText}>View active care plan</Text>
          </TouchableOpacity>
        )}

        {visit.scheduledStart && (
          <View style={styles.timeSection}>
            <Text style={styles.label}>Scheduled Time</Text>
            <Text style={styles.time}>
              {format(new Date(visit.scheduledStart), 'HH:mm')} -{' '}
              {visit.scheduledEnd && format(new Date(visit.scheduledEnd), 'HH:mm')}
            </Text>
          </View>
        )}

        {visit.clockInTime && (
          <View style={styles.timeSection}>
            <Text style={styles.label}>Clock In</Text>
            <Text style={styles.time}>
              {format(new Date(visit.clockInTime), 'HH:mm')}
            </Text>
          </View>
        )}

        {visit.clockOutTime && (
          <View style={styles.timeSection}>
            <Text style={styles.label}>Clock Out</Text>
            <Text style={styles.time}>
              {format(new Date(visit.clockOutTime), 'HH:mm')}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {canClockIn && (
            <TouchableOpacity
              style={[styles.button, styles.clockInButton]}
              onPress={handleClockIn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Clock In</Text>
              )}
            </TouchableOpacity>
          )}

          {canClockOut && (
            <TouchableOpacity
              style={[styles.button, styles.clockOutButton]}
              onPress={handleClockOut}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Clock Out</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('Checklist', {
              visitId: visit.id,
              clientId: visit.clientId,
            })
          }
        >
          <Text style={styles.actionButtonText}>Open Checklist</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Notes', { visitId: visit.id })}
        >
          <Text style={styles.actionButtonText}>Notes & Handover</Text>
        </TouchableOpacity>

        <View style={styles.medSection}>
          <Text style={styles.medSectionTitle}>Medication</Text>
          <Text style={styles.medHint}>
            Doses shown here match this visit window (scheduled time ±75 minutes). PRN medications always appear.
          </Text>
          {medications.length === 0 ? (
            <Text style={styles.medEmptyText}>No active medications configured for this client.</Text>
          ) : (
            <>
              <Text style={styles.medLabel}>Select medication</Text>
              {medications.map((med) => (
                <TouchableOpacity
                  key={med.id}
                  style={[
                    styles.medOption,
                    selectedMedicationId === med.id && styles.medOptionSelected,
                  ]}
                  onPress={() => setSelectedMedicationId(med.id)}
                >
                  <Text style={styles.medOptionTitle}>{med.name}</Text>
                  {!!med.dosage && <Text style={styles.medOptionSub}>{med.dosage}</Text>}
                </TouchableOpacity>
              ))}

              <Text style={styles.medLabel}>Outcome</Text>
              <View style={styles.medStatusRow}>
                <TouchableOpacity
                  style={[
                    styles.medStatusButton,
                    medEventStatus === MedicationEventStatus.ADMINISTERED && styles.medStatusButtonActive,
                  ]}
                  onPress={() => setMedEventStatus(MedicationEventStatus.ADMINISTERED)}
                >
                  <Text style={styles.medStatusText}>Administered</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.medStatusButton,
                    medEventStatus === MedicationEventStatus.OMITTED && styles.medStatusButtonActive,
                  ]}
                  onPress={() => setMedEventStatus(MedicationEventStatus.OMITTED)}
                >
                  <Text style={styles.medStatusText}>Omitted</Text>
                </TouchableOpacity>
              </View>

              {medEventStatus === MedicationEventStatus.OMITTED && (
                <TextInput
                  style={styles.medInput}
                  placeholder="Reason code (required)"
                  value={medReasonCode}
                  onChangeText={setMedReasonCode}
                />
              )}

              {medications.find((m) => m.id === selectedMedicationId)?.isPrn &&
                medEventStatus === MedicationEventStatus.ADMINISTERED && (
                  <>
                    <TextInput
                      style={styles.medInput}
                      placeholder="PRN indication (required)"
                      value={prnIndication}
                      onChangeText={setPrnIndication}
                    />
                    <TextInput
                      style={styles.medInput}
                      placeholder="Dosage given (required)"
                      value={prnDosageGiven}
                      onChangeText={setPrnDosageGiven}
                    />
                  </>
                )}

              {medEventStatus === MedicationEventStatus.ADMINISTERED && (
                <SignatureCapture value={signatureName} onChange={setSignatureName} required />
              )}

              <TextInput
                style={[styles.medInput, styles.medInputMultiline]}
                placeholder="Optional medication note"
                value={medNote}
                onChangeText={setMedNote}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={[styles.medInput, styles.medInputMultiline]}
                placeholder="Optional effectiveness note"
                value={effectivenessNote}
                onChangeText={setEffectivenessNote}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.button, styles.medSaveButton]}
                onPress={handleRecordMedication}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Record Medication</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Modal
        visible={showLateReasonModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowLateReasonModal(false);
          setLateReason('');
          setPendingLocation(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Late Clock-In</Text>
            <Text style={styles.modalMessage}>
              You are more than 15 minutes late. This visit will be marked as late. Please provide a reason:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              value={lateReason}
              onChangeText={setLateReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowLateReasonModal(false);
                  setLateReason('');
                  setPendingLocation(null);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSubmitLateReason}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.white,
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  address: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  carePlanLink: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary + '18',
  },
  carePlanLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  timeSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  time: {
    fontSize: 16,
    color: colors.foreground,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 12,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  clockInButton: {
    backgroundColor: '#34C759',
  },
  clockOutButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.foreground,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonSubmit: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  medSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  medSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 6,
  },
  medHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  medEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 6,
  },
  medOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  medOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF5FF',
  },
  medOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  medOptionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  medStatusButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  medStatusButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF5FF',
  },
  medStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  medInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  medInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  medSaveButton: {
    backgroundColor: colors.primary,
    marginBottom: 0,
  },
});

export default VisitDetailScreen;

