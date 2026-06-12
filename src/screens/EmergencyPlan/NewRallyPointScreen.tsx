import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useEmergencyPlanStore } from '../../stores';
import { FormButtonRow, FormInput, FormTextArea } from '../Shared/Prepper';
import { formStyles as styles } from '../Shared/Prepper/formStyles';

/**
 * Screen for adding a new rally point.
 *
 * @returns The new rally point form screen.
 */
export default observer(function NewRallyPointScreen() {
  const navigation = useNavigation();
  const store = useEmergencyPlanStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Description is required');
      return;
    }

    try {
      await store.createRallyPoint(name, description, coordinates || undefined);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to save rally point',
      );
    }
  };

  return (
    <ScreenBody>
      <SectionHeader>New Rally Point</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <FormInput
            label="Name *"
            placeholder={`e.g. "Primary: Grandma's house"`}
            value={name}
            onChangeText={setName}
            autoFocus
            accessibilityLabel="Rally point name"
          />
          <FormTextArea
            label="Description *"
            placeholder="Address or directions..."
            value={description}
            onChangeText={setDescription}
            accessibilityLabel="Description"
          />
          <FormInput
            label="Coordinates (optional)"
            placeholder='e.g. "40.7128, -74.0060"'
            value={coordinates}
            onChangeText={setCoordinates}
            accessibilityLabel="Coordinates"
          />
          <FormButtonRow
            onCancel={() => navigation.goBack()}
            onSave={handleSave}
            saveDisabled={!name.trim() || !description.trim()}
          />
        </ScrollView>
      </View>
    </ScreenBody>
  );
});
