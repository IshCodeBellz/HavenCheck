import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checklistsService } from '../../services/checklists';
import { ChecklistTemplate, ChecklistItem, ChecklistFieldType } from '../../types';
import { colors } from '../../theme/colors';

const ChecklistScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { visitId, clientId } = route.params as { visitId: string; clientId?: string };

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const templates = await checklistsService.getTemplates(clientId);
      if (templates.length > 0) {
        setTemplate(templates[0]);
        // Initialize values
        const initialValues: Record<string, any> = {};
        templates[0].items.forEach((item) => {
          if (item.type === ChecklistFieldType.BOOLEAN) {
            initialValues[item.id] = false;
          } else {
            initialValues[item.id] = '';
          }
        });
        setValues(initialValues);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert('Error', 'Failed to load checklist template');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!template) return;

    // Validate required fields
    const missingRequired = template.items.filter(
      (item) => item.required && !values[item.id]
    );
    if (missingRequired.length > 0) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const items = template.items.map((item) => {
        const value = values[item.id];
        const submissionItem: any = { checklistItemId: item.id };
        
        switch (item.type) {
          case ChecklistFieldType.BOOLEAN:
            submissionItem.valueBoolean = value;
            break;
          case ChecklistFieldType.TEXT:
            submissionItem.valueText = value;
            break;
          case ChecklistFieldType.NUMBER:
            submissionItem.valueNumber = parseFloat(value) || 0;
            break;
          case ChecklistFieldType.SELECT:
            submissionItem.valueOption = value;
            break;
        }
        
        return submissionItem;
      });

      await checklistsService.submitChecklist(visitId, template.id, items);
      Alert.alert('Success', 'Checklist submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit checklist');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (item: ChecklistItem) => {
    switch (item.type) {
      case ChecklistFieldType.BOOLEAN:
        return (
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>
                {item.label}
                {item.required && <Text style={styles.required}> *</Text>}
              </Text>
              <Switch
                value={values[item.id] || false}
                onValueChange={(value) =>
                  setValues({ ...values, [item.id]: value })
                }
              />
            </View>
          </View>
        );

      case ChecklistFieldType.TEXT:
        return (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {item.label}
              {item.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={values[item.id] || ''}
              onChangeText={(text) =>
                setValues({ ...values, [item.id]: text })
              }
              multiline
              placeholder="Enter text..."
            />
          </View>
        );

      case ChecklistFieldType.NUMBER:
        return (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {item.label}
              {item.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={styles.textInput}
              value={values[item.id]?.toString() || ''}
              onChangeText={(text) =>
                setValues({ ...values, [item.id]: text })
              }
              keyboardType="numeric"
              placeholder="Enter number..."
            />
          </View>
        );

      case ChecklistFieldType.SELECT:
        const options = item.optionsJson
          ? JSON.parse(item.optionsJson)
          : [];
        return (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {item.label}
              {item.required && <Text style={styles.required}> *</Text>}
            </Text>
            {options.map((option: string) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  values[item.id] === option && styles.optionButtonSelected,
                ]}
                onPress={() => setValues({ ...values, [item.id]: option })}
              >
                <Text
                  style={[
                    styles.optionText,
                    values[item.id] === option && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.center}>
        <Text>No checklist template found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{template.name}</Text>
          {template.description && (
            <Text style={styles.description}>{template.description}</Text>
          )}
        </View>

        {template.items.map((item) => (
          <View key={item.id}>{renderField(item)}</View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Checklist</Text>
          )}
        </TouchableOpacity>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
  },
  header: {
    backgroundColor: colors.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  field: {
    backgroundColor: colors.white,
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: colors.foreground,
  },
  optionTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChecklistScreen;

