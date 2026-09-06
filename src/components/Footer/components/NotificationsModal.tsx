import { observer } from 'mobx-react-lite';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../hooks/useTheme';
import { useNotificationsStore } from '../../../stores/StoreContext';
import { Text } from '../../ScaledText';
import { useAllNotifications } from '../useAllNotifications';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

// No-op to prevent backdrop tap propagating
const noop = () => {};

/**
 * Renders a modal that lists all current in-app notifications with individual
 * dismiss buttons.  Dismissed notifications are persisted via NotificationsStore
 * (AsyncStorage) so they do not reappear after closing and reopening.
 */
const NotificationsModal = observer(
  ({ visible, onClose }: NotificationsModalProps) => {
    const COLORS = useTheme();
    const notificationsStore = useNotificationsStore();
    const allNotifications = useAllNotifications();

    const visibleNotifications = allNotifications.filter(
      (n) => !notificationsStore.isHidden(n.key),
    );

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={noop}>
              <View
                style={[
                  styles.modalContainer,
                  {
                    backgroundColor: COLORS.PRIMARY_LIGHT,
                    borderColor: COLORS.BRAND,
                  },
                ]}
              >
                {/* Header */}
                <View
                  style={[
                    styles.header,
                    {
                      backgroundColor: COLORS.SECONDARY_ACCENT,
                      borderBottomColor: COLORS.BRAND,
                    },
                  ]}
                >
                  <Text
                    style={[styles.headerText, { color: COLORS.PRIMARY_DARK }]}
                  >
                    NOTIFICATIONS
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    accessibilityLabel="Close notifications"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="close-outline"
                      size={28}
                      color={COLORS.PRIMARY_DARK}
                    />
                  </TouchableOpacity>
                </View>

                {/* Body */}
                {visibleNotifications.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={48}
                      color={COLORS.ACCENT}
                    />
                    <Text
                      style={[
                        styles.emptyStateText,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                    >
                      No active notifications
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                  >
                    {visibleNotifications.map((notification) => (
                      <View
                        key={notification.key}
                        style={[
                          styles.notificationRow,
                          {
                            borderColor: COLORS.BRAND,
                            backgroundColor: notification.highlightColor
                              ? notification.highlightColor
                              : COLORS.BACKGROUND,
                          },
                        ]}
                      >
                        {/* Icon */}
                        <View style={styles.iconWrapper}>
                          {notification.iconEmoji ? (
                            <Text style={styles.emojiIcon}>
                              {notification.iconEmoji}
                            </Text>
                          ) : notification.icon ? (
                            <Ionicons
                              name={notification.icon}
                              size={22}
                              color={notification.iconColor}
                            />
                          ) : null}
                        </View>

                        {/* Message */}
                        <Text
                          style={[
                            styles.notificationText,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {notification.message}
                        </Text>

                        {/* Dismiss button */}
                        <Pressable
                          onPress={() =>
                            notificationsStore.hideNotification(
                              notification.key,
                            )
                          }
                          style={styles.dismissButton}
                          accessibilityLabel={`Dismiss notification: ${notification.message}`}
                          accessibilityRole="button"
                          hitSlop={8}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={22}
                            color={COLORS.PRIMARY_DARK}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  },
);

export default NotificationsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 500,
    height: '70%',
    borderRadius: 16,
    borderWidth: 3,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrapper: {
    width: 24,
    alignItems: 'center',
    flexShrink: 0,
  },
  emojiIcon: {
    fontSize: 18,
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  dismissButton: {
    flexShrink: 0,
    padding: 2,
  },
});
