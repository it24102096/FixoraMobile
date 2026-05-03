import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { serviceService } from '../services/serviceService';

type Props = NativeStackScreenProps<RootStackParamList, 'AddService'>;

const AddServiceScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !description.trim() || !category.trim() || !basePrice.trim() || !estimatedDuration.trim()) {
      Alert.alert('Validation', 'Please fill all required fields.');
      return;
    }

    const parsedPrice = Number(basePrice);
    const parsedDuration = Number(estimatedDuration);

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Validation', 'Base price must be a valid number greater than 0.');
      return;
    }

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
      Alert.alert('Validation', 'Estimated duration must be a valid number greater than 0.');
      return;
    }

    setLoading(true);
    try {
      await serviceService.createService({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        basePrice: parsedPrice,
        estimatedDuration: parsedDuration,
        currency: 'USD',
        icon: icon.trim() || undefined,
      });

      Alert.alert('Success', 'Service created successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'),
        },
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create service.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#071428" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Add New Service</Text>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} disabled={loading}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Service Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="AC Repair"
            placeholderTextColor="#6b82a3"
            editable={!loading}
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Short service description"
            placeholderTextColor="#6b82a3"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!loading}
          />

          <Text style={styles.label}>Category *</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Electrical"
            placeholderTextColor="#6b82a3"
            editable={!loading}
          />

          <Text style={styles.label}>Base Price (USD) *</Text>
          <TextInput
            style={styles.input}
            value={basePrice}
            onChangeText={setBasePrice}
            placeholder="100"
            placeholderTextColor="#6b82a3"
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Estimated Duration (hours) *</Text>
          <TextInput
            style={styles.input}
            value={estimatedDuration}
            onChangeText={setEstimatedDuration}
            placeholder="1"
            placeholderTextColor="#6b82a3"
            keyboardType="decimal-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Icon (optional)</Text>
          <TextInput
            style={styles.input}
            value={icon}
            onChangeText={setIcon}
            placeholder="wrench"
            placeholderTextColor="#6b82a3"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#071428" /> : <Text style={styles.submitBtnText}>Create Service</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071428',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '800',
  },
  closeText: {
    color: '#00d4e8',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#0a1a35',
    borderWidth: 1,
    borderColor: '#1d3b63',
    borderRadius: 16,
    padding: 16,
  },
  label: {
    color: '#bacbe0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0c2242',
    borderWidth: 1,
    borderColor: '#1d3b63',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 100,
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: '#00d4e8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#071428',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default AddServiceScreen;
