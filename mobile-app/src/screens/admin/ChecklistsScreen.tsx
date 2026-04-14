import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { checklistsService } from "../../services/checklists";
import { clientsService } from "../../services/clients";
import { ChecklistTemplate, Client, ChecklistFieldType } from "../../types";
import { colors } from '../../theme/colors';

interface ChecklistItem {
  label: string;
  type: ChecklistFieldType;
  required: boolean;
  optionsJson?: string;
}

const ChecklistsScreen: React.FC = () => {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    clientId: "",
  });
  const [items, setItems] = useState<ChecklistItem[]>([
    { label: "", type: ChecklistFieldType.BOOLEAN, required: false },
  ]);

  useEffect(() => {
    loadTemplates();
    loadClients();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await checklistsService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await clientsService.getClients();
      setClients(data.filter((c) => c.active));
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const addItem = () => {
    setItems([
      ...items,
      { label: "", type: ChecklistFieldType.BOOLEAN, required: false },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (
    index: number,
    field: keyof ChecklistItem,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Error", "Please enter a template name");
      return;
    }

    const validItems = items.filter((item) => item.label.trim().length > 0);
    if (validItems.length === 0) {
      Alert.alert("Error", "At least one checklist item is required");
      return;
    }

    // Validate SELECT items have options
    for (const item of validItems) {
      if (
        item.type === ChecklistFieldType.SELECT &&
        !item.optionsJson?.trim()
      ) {
        Alert.alert("Error", `Please provide options for "${item.label}"`);
        return;
      }
    }

    try {
      setSubmitting(true);

      // Process SELECT items - convert options string to JSON
      const processedItems = validItems.map((item) => {
        if (item.type === ChecklistFieldType.SELECT && item.optionsJson) {
          const options = item.optionsJson
            .split(",")
            .map((opt) => opt.trim())
            .filter(Boolean);
          return {
            ...item,
            optionsJson: JSON.stringify(options),
          };
        }
        return item;
      });

      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        items: processedItems,
      };

      if (formData.clientId) {
        payload.clientId = formData.clientId;
      }

      await checklistsService.createTemplate(payload);
      setShowAddModal(false);
      setFormData({ name: "", description: "", clientId: "" });
      setItems([
        { label: "", type: ChecklistFieldType.BOOLEAN, required: false },
      ]);
      loadTemplates();
      Alert.alert("Success", "Checklist template created successfully");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.error ||
          error.message ||
          "Failed to create checklist template"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderTemplate = ({ item }: { item: ChecklistTemplate }) => {
    const client = clients.find((c) => c.id === item.clientId);
    return (
      <View style={styles.templateItem}>
        <Text style={styles.templateName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.templateDescription}>{item.description}</Text>
        )}
        {client && (
          <Text style={styles.templateClient}>For: {client.name}</Text>
        )}
        <Text style={styles.templateItems}>{item.items.length} items</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No checklist templates found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+ Create Template</Text>
      </TouchableOpacity>

      {/* Create Checklist Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Create Checklist Template</Text>

              <Text style={styles.label}>Template Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder="e.g., Daily Care Checklist"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholder="Optional description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Client (Optional)</Text>
              <ScrollView style={styles.picker}>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    !formData.clientId && styles.pickerOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, clientId: "" })}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      !formData.clientId && styles.pickerTextActive,
                    ]}
                  >
                    All Clients (General Template)
                  </Text>
                </TouchableOpacity>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.pickerOption,
                      formData.clientId === client.id &&
                        styles.pickerOptionActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, clientId: client.id })
                    }
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        formData.clientId === client.id &&
                          styles.pickerTextActive,
                      ]}
                    >
                      {client.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.itemsHeader}>
                <Text style={styles.label}>Checklist Items *</Text>
                <TouchableOpacity
                  onPress={addItem}
                  style={styles.addItemButton}
                >
                  <Text style={styles.addItemButtonText}>+ Add Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <Text style={styles.itemLabel}>Item Label *</Text>
                  <TextInput
                    style={styles.input}
                    value={item.label}
                    onChangeText={(text) => updateItem(index, "label", text)}
                    placeholder="e.g., Medication given"
                  />

                  <Text style={styles.itemLabel}>Type *</Text>
                  <ScrollView style={styles.picker}>
                    {Object.values(ChecklistFieldType).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pickerOption,
                          item.type === type && styles.pickerOptionActive,
                        ]}
                        onPress={() => updateItem(index, "type", type)}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            item.type === type && styles.pickerTextActive,
                          ]}
                        >
                          {type === ChecklistFieldType.BOOLEAN
                            ? "Yes/No"
                            : type === ChecklistFieldType.TEXT
                            ? "Text"
                            : type === ChecklistFieldType.NUMBER
                            ? "Number"
                            : "Select (Dropdown)"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {item.type === ChecklistFieldType.SELECT && (
                    <>
                      <Text style={styles.itemLabel}>
                        Options (comma-separated) *
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={item.optionsJson || ""}
                        onChangeText={(text) =>
                          updateItem(index, "optionsJson", text)
                        }
                        placeholder="e.g., Option 1, Option 2, Option 3"
                      />
                    </>
                  )}

                  <View style={styles.itemFooter}>
                    <View style={styles.requiredRow}>
                      <Text style={styles.requiredLabel}>Required</Text>
                      <Switch
                        value={item.required}
                        onValueChange={(value) =>
                          updateItem(index, "required", value)
                        }
                      />
                    </View>
                    {items.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(index)}>
                        <Text style={styles.removeButton}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
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
                    <Text style={styles.submitButtonText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 80 },
  templateItem: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  templateName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 8,
  },
  templateDescription: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  templateClient: { fontSize: 14, color: colors.primary, marginBottom: 4 },
  templateItems: { fontSize: 14, color: colors.textMuted },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, color: colors.textMuted },
  addButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    left: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.foreground,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  picker: {
    maxHeight: 150,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: colors.primary,
  },
  pickerText: {
    fontSize: 16,
    color: colors.foreground,
  },
  pickerTextActive: {
    color: colors.white,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  addItemButton: {
    padding: 8,
  },
  addItemButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  itemCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
    marginTop: 12,
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  requiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requiredLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  removeButton: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
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
});

export default ChecklistsScreen;
