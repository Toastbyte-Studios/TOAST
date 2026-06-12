import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useEmergencyPlanStore } from '../../stores';
import { EmergencyContact } from '../../stores/EmergencyPlanStore';
import {
  DeleteButton,
  FormButtonRow,
  FormInput,
  FormTextArea,
} from '../Shared/Prepper';
import { formStyles as styles } from '../Shared/Prepper/formStyles';

type EditEmergencyContactRouteProp = RouteProp<
  { EditEmergencyContact: { contact: EmergencyContact } },
  'EditEmergencyContact'
>;

/**
 * Screen for editing an existing emergency contact.
 *
 * @returns The edit emergency contact form screen.
 */
export default observer(function EditEmergencyContactScreen() {
  const navigation = useNavigation();
  const route = useRoute<EditEmergencyContactRouteProp>();
  const store = useEmergencyPlanStore();

  const { contact } = route.params || {};

  const [name, setName] = useState(contact?.name || '');
  const [relationship, setRelationship] = useState(contact?.relationship || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [notes, setNotes] = useState(contact?.notes || '');

  if (!contact) {
    navigation.goBack();
    return null;
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!relationship.trim()) {
      Alert.alert('Error', 'Relationship is required');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    try {
      await store.updateContact(contact.id, {
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update contact');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${contact.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await store.deleteContact(contact.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete contact');
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenBody>
      <SectionHeader>Edit Contact</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <FormInput
            label="Name *"
            placeholder="Enter full name..."
            value={name}
            onChangeText={setName}
            accessibilityLabel="Contact name"
          />
          <FormInput
            label="Relationship *"
            placeholder="e.g. Spouse, Parent, Neighbor..."
            value={relationship}
            onChangeText={setRelationship}
            accessibilityLabel="Relationship"
          />
          <FormInput
            label="Phone Number *"
            placeholder="Enter phone number..."
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel="Phone number"
          />
          <FormTextArea
            label="Notes (optional)"
            placeholder="Additional details..."
            value={notes}
            onChangeText={setNotes}
            accessibilityLabel="Notes"
          />
          <FormButtonRow
            onCancel={() => navigation.goBack()}
            onSave={handleSave}
            saveDisabled={!name.trim() || !relationship.trim() || !phone.trim()}
          />
          <DeleteButton onPress={handleDelete} label="Delete Contact" />
        </ScrollView>
      </View>
    </ScreenBody>
  );
});
