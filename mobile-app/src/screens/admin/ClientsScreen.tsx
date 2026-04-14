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
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { clientsService } from "../../services/clients";
import { Client } from "../../types";
import { colors } from '../../theme/colors';

const ClientsScreen: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    geofenceRadiusMeters: "",
    contactName: "",
    contactPhone: "",
    notes: "",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await clientsService.getClients();
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClients();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      Alert.alert("Error", "Please fill in name and address");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        name: formData.name,
        address: formData.address,
      };

      if (formData.latitude) payload.latitude = parseFloat(formData.latitude);
      if (formData.longitude)
        payload.longitude = parseFloat(formData.longitude);
      if (formData.geofenceRadiusMeters)
        payload.geofenceRadiusMeters = parseInt(formData.geofenceRadiusMeters);
      if (formData.contactName) payload.contactName = formData.contactName;
      if (formData.contactPhone) payload.contactPhone = formData.contactPhone;
      if (formData.notes) payload.notes = formData.notes;

      await clientsService.createClient(payload);
      setShowAddModal(false);
      setFormData({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        geofenceRadiusMeters: "",
        contactName: "",
        contactPhone: "",
        notes: "",
      });
      loadClients();
      Alert.alert("Success", "Client created successfully");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to create client"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.clientItem}>
      <View style={styles.clientHeader}>
        <Text style={styles.clientName}>{item.name}</Text>
        {item.active ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>Active</Text>
          </View>
        ) : (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveText}>Inactive</Text>
          </View>
        )}
      </View>
      <Text style={styles.clientAddress}>{item.address}</Text>
      {item.contactName && (
        <Text style={styles.clientContact}>Contact: {item.contactName}</Text>
      )}
      {item.contactPhone && (
        <Text style={styles.clientContact}>Phone: {item.contactPhone}</Text>
      )}
    </View>
  );

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
        data={clients}
        renderItem={renderClient}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No clients found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+ Add Client</Text>
      </TouchableOpacity>

      {/* Add Client Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add New Client</Text>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder="Enter name"
              />

              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(text) =>
                  setFormData({ ...formData, address: text })
                }
                placeholder="Enter address"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={formData.latitude}
                onChangeText={(text) =>
                  setFormData({ ...formData, latitude: text })
                }
                placeholder="Enter latitude"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={formData.longitude}
                onChangeText={(text) =>
                  setFormData({ ...formData, longitude: text })
                }
                placeholder="Enter longitude"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Geofence Radius (meters)</Text>
              <TextInput
                style={styles.input}
                value={formData.geofenceRadiusMeters}
                onChangeText={(text) =>
                  setFormData({ ...formData, geofenceRadiusMeters: text })
                }
                placeholder="Enter radius"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={formData.contactName}
                onChangeText={(text) =>
                  setFormData({ ...formData, contactName: text })
                }
                placeholder="Enter contact name"
              />

              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.contactPhone}
                onChangeText={(text) =>
                  setFormData({ ...formData, contactPhone: text })
                }
                placeholder="Enter contact phone"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) =>
                  setFormData({ ...formData, notes: text })
                }
                placeholder="Enter notes"
                multiline
                numberOfLines={4}
              />

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  clientItem: {
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
  clientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clientName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    flex: 1,
  },
  activeBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  inactiveBadge: {
    backgroundColor: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inactiveText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  clientAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  clientContact: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
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
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
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

export default ClientsScreen;
