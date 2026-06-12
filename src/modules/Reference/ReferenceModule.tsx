import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { REFERENCE_TOOLS } from '../../../constants';
import { HorizontalRule } from '../../components/HorizontalRule';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import ToolList from '../../components/ToolList';
import { useTheme } from '../../hooks/useTheme';

/**
 * Renders the Reference screen.
 *
 * Displays a section header labeled "Reference", an action bar with a bookmark icon,
 * and a list of available reference tools.
 *
 * @returns A React element containing the Reference screen layout.
 */
export default function ReferenceModule() {
  const navigation = useNavigation();
  const COLORS = useTheme();

  return (
    <ScreenBody>
      <SectionHeader>Reference</SectionHeader>
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Bookmark')}
          accessibilityLabel="Bookmarks"
          accessibilityRole="button"
        >
          <Ionicons
            name="bookmark-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      </View>
      <HorizontalRule />
      <ToolList tools={REFERENCE_TOOLS} />
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  actionButton: {
    paddingVertical: 6,
  },
});
