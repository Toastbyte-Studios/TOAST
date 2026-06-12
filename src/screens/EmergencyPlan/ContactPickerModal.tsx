import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  PermissionsAndroid,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import { useTheme } from '../../hooks/useTheme';

interface RawContact {
  recordID?: string;
  givenName?: string;
  familyName?: string;
  company?: string;
  phoneNumbers: Array<{ number: string }>;
}

interface ContactsModule {
  getAll(): Promise<RawContact[]>;
  requestPermission(): Promise<string>;
}

let Contacts: ContactsModule | null = null;
try {
  Contacts = require('react-native-contacts').default;
} catch {
  // react-native-contacts not available
}

export const contactsAvailable = !!Contacts;

interface DeviceContact {
  id: string;
  name: string;
  phone: string;
}

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with (name, phone) when the user picks a contact. */
  onSelect: (name: string, phone: string) => void;
}

/**
 * Modal that lists device contacts filtered to those with at least one phone number.
 * Handles permission requests for both iOS and Android.
 *
 * Calls `onSelect(name, phone)` with the first phone number when the user picks a contact,
 * then automatically closes.
 */
export function ContactPickerModal({
  visible,
  onClose,
  onSelect,
}: ContactPickerModalProps): React.JSX.Element {
  const COLORS = useTheme();
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    if (!Contacts) {
      setError('Contacts are not available on this device.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Permission to access contacts was denied.');
          return;
        }
      } else {
        const permission = await Contacts.requestPermission();
        if (permission !== 'authorized') {
          setError('Permission to access contacts was denied.');
          return;
        }
      }

      const all = await Contacts.getAll();
      const withPhones: DeviceContact[] = all
        .filter(
          (c: RawContact) =>
            Array.isArray(c.phoneNumbers) && c.phoneNumbers.length > 0,
        )
        .map((c: RawContact) => ({
          id:
            c.recordID ??
            `${c.givenName ?? ''}-${c.familyName ?? ''}-${c.phoneNumbers[0].number}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name:
            [c.givenName, c.familyName].filter(Boolean).join(' ') ||
            c.company ||
            'Unknown',
          phone: c.phoneNumbers[0].number,
        }))
        .sort((a: DeviceContact, b: DeviceContact) =>
          a.name.localeCompare(b.name),
        );
      setContacts(withPhones);
    } catch {
      setError('Could not load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setContacts([]);
      loadContacts();
    }
  }, [visible, loadContacts]);

  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search),
      )
    : contacts;

  const handleSelect = (item: DeviceContact) => {
    onSelect(item.name, item.phone);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      testID="contact-picker-modal"
    >
      <View style={[styles.container, { backgroundColor: COLORS.BACKGROUND }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: COLORS.PRIMARY_LIGHT,
              borderBottomColor: COLORS.SECONDARY_ACCENT,
            },
          ]}
        >
          <Text style={[styles.title, { color: COLORS.PRIMARY_DARK }]}>
            Select Contact
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons
              name="close-outline"
              size={28}
              color={COLORS.PRIMARY_DARK}
            />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.search,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.SECONDARY_ACCENT,
                color: COLORS.PRIMARY_DARK,
              },
            ]}
            placeholder="Search contacts..."
            placeholderTextColor={COLORS.PRIMARY_DARK + '80'}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            accessibilityLabel="Search contacts"
          />
        </View>

        {/* States */}
        {loading && (
          <ActivityIndicator
            style={styles.center}
            color={COLORS.PRIMARY_DARK}
          />
        )}
        {!loading && error ? (
          <Text
            style={[styles.center, styles.errorText, { color: COLORS.ERROR }]}
          >
            {error}
          </Text>
        ) : null}

        {/* Contacts list */}
        {!loading && !error && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.item,
                  {
                    backgroundColor: COLORS.PRIMARY_LIGHT,
                    borderBottomColor: COLORS.SECONDARY_ACCENT,
                  },
                ]}
                onPress={() => handleSelect(item)}
                accessibilityLabel={`${item.name}, ${item.phone}`}
                accessibilityRole="button"
              >
                <View style={styles.itemIcon}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={COLORS.PRIMARY_DARK}
                  />
                </View>
                <View style={styles.itemBody}>
                  <Text
                    style={[styles.itemName, { color: COLORS.PRIMARY_DARK }]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.itemPhone, { color: COLORS.PRIMARY_DARK }]}
                  >
                    {item.phone}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text
                style={[
                  styles.center,
                  styles.emptyText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                No contacts with phone numbers found.
              </Text>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  center: {
    marginTop: 32,
    textAlign: 'center',
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 15,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.7,
    paddingHorizontal: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemPhone: {
    fontSize: 14,
    opacity: 0.75,
  },
});
