import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useEmergencyPlanStore } from '../../stores';
import { FormButtonRow, FormInput, FormTextArea } from '../Shared/Prepper';
import { formStyles as styles } from '../Shared/Prepper/formStyles';
import { ContactPickerModal, contactsAvailable } from './ContactPickerModal';

/**
 * Screen for adding a new emergency contact.
 *
 * Supports two entry methods:
 * - Manual entry of name, relationship, phone, and notes.
 * - Import from the device's native contacts (pre-fills name and phone).
 *
 * @returns The new emergency contact form screen.
 */
export default observer(function NewEmergencyContactScreen() {
  const navigation = useNavigation();
  const store = useEmergencyPlanStore();
  const COLORS = useTheme();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);

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
      await store.createContact(name, relationship, phone, notes || undefined);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save contact');
    }
  };

  const handleContactSelected = (contactName: string, contactPhone: string) => {
    setName(contactName);
    setPhone(contactPhone);
  };

  return (
    <ScreenBody>
      <SectionHeader>New Contact</SectionHeader>

      {/* Import from device contacts — only shown when native module is available */}
      {contactsAvailable && (
        <TouchableOpacity
          style={[
            localStyles.importBanner,
            {
              backgroundColor: COLORS.PRIMARY_LIGHT,
              borderColor: COLORS.SECONDARY_ACCENT,
            },
          ]}
          onPress={() => setPickerVisible(true)}
          accessibilityLabel="Import from contacts"
          accessibilityRole="button"
        >
          <Ionicons
            name="people-outline"
            size={20}
            color={COLORS.PRIMARY_DARK}
            style={localStyles.importIcon}
          />
          <Text
            style={[localStyles.importText, { color: COLORS.PRIMARY_DARK }]}
          >
            Import from Contacts
          </Text>
          <Ionicons
            name="chevron-forward-outline"
            size={16}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      )}

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
        </ScrollView>
      </View>

      <ContactPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleContactSelected}
      />
    </ScreenBody>
  );
});

const localStyles = StyleSheet.create({
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  importIcon: {
    marginRight: 8,
  },
  importText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
