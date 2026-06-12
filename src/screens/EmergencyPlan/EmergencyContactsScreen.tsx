import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useEmergencyPlanStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';

/**
 * Lists all emergency contacts with options to add or edit them.
 *
 * @returns The emergency contacts list screen.
 */
export default observer(function EmergencyContactsScreen() {
  const navigation = useNavigation();
  const store = useEmergencyPlanStore();
  const COLORS = useTheme();

  return (
    <ScreenBody>
      <SectionHeader>Emergency Contacts</SectionHeader>
      <View style={styles.addRow}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: COLORS.PRIMARY_DARK }]}
          onPress={() => navigation.navigate('NewEmergencyContact')}
          accessibilityLabel="Add Contact"
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={22} color={COLORS.PRIMARY_LIGHT} />
          <Text style={[styles.addButtonText, { color: COLORS.PRIMARY_LIGHT }]}>
            Add Contact
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {store.contacts.length === 0 && (
            <Text style={[styles.emptyText, { color: COLORS.PRIMARY_DARK }]}>
              No contacts yet. Add a contact to get started.
            </Text>
          )}
          {store.contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={[
                styles.card,
                {
                  backgroundColor: COLORS.PRIMARY_LIGHT,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={() =>
                navigation.navigate('EditEmergencyContact', { contact })
              }
              accessibilityLabel={`Edit ${contact.name}`}
              accessibilityRole="button"
            >
              <View style={styles.cardBody}>
                <Text style={[styles.name, { color: COLORS.PRIMARY_DARK }]}>
                  {contact.name}
                </Text>
                <Text
                  style={[styles.relationship, { color: COLORS.PRIMARY_DARK }]}
                >
                  {contact.relationship}
                </Text>
                <Text style={[styles.phone, { color: COLORS.PRIMARY_DARK }]}>
                  {contact.phone}
                </Text>
                {contact.notes ? (
                  <Text style={[styles.notes, { color: COLORS.PRIMARY_DARK }]}>
                    {contact.notes}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color={COLORS.PRIMARY_DARK}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  addRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    width: '100%',
    alignItems: 'flex-end',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingBottom: FOOTER_HEIGHT,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardBody: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  relationship: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    marginBottom: 2,
  },
  notes: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 4,
  },
});
