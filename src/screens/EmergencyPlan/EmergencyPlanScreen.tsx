import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useEmergencyPlanStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';

/**
 * Emergency Contact & Rally Point Planner landing screen.
 *
 * Presents the three planning sections:
 * - Emergency Contacts
 * - Rally Points
 * - Communication Plan
 *
 * @returns A screen layout with navigation cards for each section.
 */
export default observer(function EmergencyPlanScreen() {
  const navigation = useNavigation();
  const store = useEmergencyPlanStore();
  const COLORS = useTheme();

  const sections = [
    {
      title: 'Emergency Contacts',
      subtitle: `${store.contacts.length} contact${store.contacts.length !== 1 ? 's' : ''}`,
      icon: 'people-outline',
      screen: 'EmergencyContacts',
    },
    {
      title: 'Rally Points',
      subtitle: `${store.rallyPoints.length} location${store.rallyPoints.length !== 1 ? 's' : ''}`,
      icon: 'location-outline',
      screen: 'RallyPoints',
    },
    {
      title: 'Communication Plan',
      subtitle: 'Who calls whom, fallback plan',
      icon: 'chatbubbles-outline',
      screen: 'CommunicationPlan',
    },
  ];

  return (
    <ScreenBody>
      <SectionHeader>Emergency Planner</SectionHeader>
      <View style={[styles.container, { paddingBottom: FOOTER_HEIGHT }]}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.screen}
            style={[
              styles.card,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.SECONDARY_ACCENT,
              },
            ]}
            onPress={() => navigation.navigate(section.screen)}
            accessibilityLabel={section.title}
            accessibilityRole="button"
          >
            <View style={styles.cardIcon}>
              <Ionicons
                name={section.icon}
                size={32}
                color={COLORS.PRIMARY_DARK}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: COLORS.PRIMARY_DARK }]}>
                {section.title}
              </Text>
              <Text
                style={[styles.cardSubtitle, { color: COLORS.PRIMARY_DARK }]}
              >
                {section.subtitle}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward-outline"
              size={20}
              color={COLORS.PRIMARY_DARK}
            />
          </TouchableOpacity>
        ))}
      </View>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardIcon: {
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
});
