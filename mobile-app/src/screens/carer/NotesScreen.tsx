import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notesService } from "../../services/notes";
import { Note, NoteType, NotePriority } from "../../types";
import { format } from "date-fns";
import { colors } from '../../theme/colors';

const DRAWER_WIDTH = Dimensions.get("window").width * 0.85;

const NotesScreen: React.FC = () => {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { visitId } = route.params as { visitId: string };

  const [activeTab, setActiveTab] = useState<"notes" | "handover" | "incident">(
    "notes"
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    text: "",
    type: NoteType.GENERAL,
    priority: NotePriority.NORMAL,
  });

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    loadNotes();
  }, [activeTab, visitId]);

  useEffect(() => {
    if (showAddForm) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddForm]);

  const closeDrawer = () => {
    setShowAddForm(false);
    setFormData({
      text: "",
      type: NoteType.GENERAL,
      priority: NotePriority.NORMAL,
    });
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      let data: Note[];
      if (activeTab === "handover") {
        data = await notesService.getHandoverNotes(visitId);
      } else if (activeTab === "incident") {
        data = await notesService.getNotes(visitId, NoteType.INCIDENT);
      } else {
        // "notes" tab shows GENERAL notes
        data = await notesService.getNotes(visitId, NoteType.GENERAL);
      }
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.text.trim()) {
      Alert.alert("Error", "Please enter note text");
      return;
    }

    try {
      setSubmitting(true);
      let noteType: NoteType;
      if (activeTab === "handover") {
        noteType = NoteType.HANDOVER;
      } else if (activeTab === "incident") {
        noteType = NoteType.INCIDENT;
      } else {
        noteType = formData.type;
      }
      await notesService.createNote(
        visitId,
        formData.text,
        noteType,
        formData.priority
      );
      setFormData({
        text: "",
        type: NoteType.GENERAL,
        priority: NotePriority.NORMAL,
      });
      closeDrawer();
      loadNotes();
      Alert.alert("Success", "Note added successfully");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={[styles.tabs, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "notes" && styles.tabActive]}
            onPress={() => setActiveTab("notes")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "notes" && styles.tabTextActive,
              ]}
            >
              General
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "handover" && styles.tabActive]}
            onPress={() => setActiveTab("handover")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "handover" && styles.tabTextActive,
              ]}
            >
              Handover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "incident" && styles.tabActive]}
            onPress={() => setActiveTab("incident")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "incident" && styles.tabTextActive,
              ]}
            >
              Incident
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.notesContainer}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : notes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notes yet</Text>
            </View>
          ) : (
            notes.map((note) => (
              <View
                key={note.id}
                style={[
                  styles.noteCard,
                  note.type === NoteType.INCIDENT &&
                    note.priority === NotePriority.HIGH &&
                    styles.incidentHighPriorityCard,
                  note.type === NoteType.INCIDENT &&
                    note.priority === NotePriority.NORMAL &&
                    styles.incidentNormalPriorityCard,
                  note.type === NoteType.HANDOVER && styles.handoverCard,
                ]}
              >
                <View style={styles.noteHeader}>
                  <View style={styles.noteAuthorContainer}>
                    <Text style={styles.noteAuthor}>{note.author.name}</Text>
                    {note.type === NoteType.INCIDENT &&
                      note.priority === NotePriority.HIGH && (
                        <View style={styles.highPriorityBadge}>
                          <Text style={styles.highPriorityBadgeText}>
                            HIGH PRIORITY
                          </Text>
                        </View>
                      )}
                  </View>
                  <Text style={styles.noteDate}>
                    {format(new Date(note.createdAt), "MMM d, HH:mm")}
                  </Text>
                </View>
                {note.type !== NoteType.INCIDENT && (
                  <View style={styles.noteMeta}>
                    <Text style={styles.noteType}>{note.type}</Text>
                  </View>
                )}
                <Text style={styles.noteText}>{note.text}</Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Text style={styles.addButtonText}>Add Note</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Backdrop */}
      {showAddForm && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeDrawer}
        />
      )}

      {/* Drawer sliding from left */}
      {showAddForm && (
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={{ paddingTop: insets.top }}
          >
            {activeTab === "notes" && (
              <>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeButtons}>
                  {[NoteType.GENERAL].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.type === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Priority</Text>
                <View style={styles.typeButtons}>
                  {Object.values(NotePriority).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.typeButton,
                        formData.priority === priority &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, priority })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.priority === priority &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {activeTab === "incident" && (
              <>
                <Text style={styles.label}>Priority</Text>
                <View style={styles.typeButtons}>
                  {Object.values(NotePriority).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.typeButton,
                        formData.priority === priority &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, priority })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.priority === priority &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.textInput}
              value={formData.text}
              onChangeText={(text) => setFormData({ ...formData, text })}
              multiline
              placeholder="Enter note..."
            />

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeDrawer}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  formContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.foreground,
    marginBottom: 8,
    marginTop: 16,
  },
  typeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    marginRight: 8,
    marginBottom: 8,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.foreground,
  },
  typeButtonTextActive: {
    color: colors.white,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: colors.border,
  },
  formButtons: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.foreground,
    fontWeight: "600",
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: "600",
  },
  notesContainer: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  noteCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  handoverCard: {
    borderLeftColor: colors.primary,
  },
  incidentHighPriorityCard: {
    borderLeftColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
  },
  incidentNormalPriorityCard: {
    borderLeftColor: "#FF9500",
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  noteAuthorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  noteAuthor: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
  },
  noteDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  noteMeta: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  noteType: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  highPriorityBadge: {
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  highPriorityBadgeText: {
    fontSize: 10,
    color: "#C62828",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  noteText: {
    fontSize: 16,
    color: colors.foreground,
    lineHeight: 22,
  },
  footer: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default NotesScreen;
