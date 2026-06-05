import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
  Text as RNText,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  onLaunchTutorial?: () => void;
}

type HelpSection = 'what' | 'how' | 'privacy' | 'terms' | 'contact';

interface AccordionItem {
  id: HelpSection;
  title: string;
  content: string;
}

/**
 * Help modal component that overlays on top of the app.
 * Displays help topics in an accordion menu format.
 * When a topic is clicked, it expands to show content and collapses any other open topics.
 *
 * Note: Uses React Native's Text directly to avoid scaling issues in the help UI.
 */

// No-op handler to prevent backdrop touch from propagating
const preventClose = () => {};

export const HelpModal = ({
  visible,
  onClose,
  onLaunchTutorial,
}: HelpModalProps) => {
  const COLORS = useTheme();
  const [expandedSection, setExpandedSection] = useState<HelpSection | null>(
    null,
  );

  const renderLinkableText = (text: string) => {
    // Regex patterns for URLs and emails
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

    // Split text by both URLs and emails, preserving the delimiters
    const parts: Array<{ type: 'text' | 'url' | 'email'; content: string }> =
      [];
    let lastIndex = 0;

    // First, find all URLs
    const urlMatches = Array.from(text.matchAll(urlRegex));
    // Then find all emails
    const emailMatches = Array.from(text.matchAll(emailRegex));

    // Combine and sort all matches by position
    const allMatches = [
      ...urlMatches.map((m) => ({ ...m, type: 'url' as const })),
      ...emailMatches.map((m) => ({ ...m, type: 'email' as const })),
    ].sort((a, b) => a.index! - b.index!);

    allMatches.forEach((match) => {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;

      // Add text before this match
      if (lastIndex < matchStart) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, matchStart),
        });
      }

      // Add the match itself
      parts.push({
        type: match.type,
        content: match[0],
      });

      lastIndex = matchEnd;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return parts.map((part, index) => {
      if (part.type === 'url') {
        return (
          <RNText
            key={index}
            style={[styles.link, { color: COLORS.SECONDARY_ACCENT }]}
            onPress={() => Linking.openURL(part.content)}
          >
            {part.content}
          </RNText>
        );
      } else if (part.type === 'email') {
        return (
          <RNText
            key={index}
            style={[styles.link, { color: COLORS.SECONDARY_ACCENT }]}
            onPress={() => Linking.openURL(`mailto:${part.content}`)}
          >
            {part.content}
          </RNText>
        );
      } else {
        return <RNText key={index}>{part.content}</RNText>;
      }
    });
  };

  const helpSections: AccordionItem[] = [
    {
      id: 'what',
      title: 'What is TOAST',
      content:
        'TOAST (Trusted Outdoor And Survival Toolkit) is a comprehensive mobile application designed to assist users in various tactical and survival situations. It provides essential tools, references, and utilities in one convenient package.',
    },
    {
      id: 'how',
      title: 'How to use',
      content:
        'Navigate through TOAST using the intuitive menu system. Access different tools and features from the home screen. Swipe left or right to navigate between screens. Tap on any tool to open it. Use the settings button (top right) to customize your experience.',
    },
    {
      id: 'privacy',
      title: 'Privacy Policy',
      content:
        "Your privacy is important to us. TOAST operates primarily offline and does not collect or transmit personal data without your explicit consent...which we don't ask for because we don't need it. Any data stored is kept locally on your device. For more details, please contact us at info@toastbyte.studio or visit our website: https://toastbyte.studio/toast/privacy.",
    },
    {
      id: 'terms',
      title: 'Terms of Use',
      content:
        'By using TOAST, you agree to use this application responsibly and in accordance with all applicable laws. This application is provided "as-is" without warranties of any kind. The developers are not liable for any decisions made based on information provided by this app. For complete terms, visit our website: https://toastbyte.studio/toast/terms.',
    },
    {
      id: 'contact',
      title: 'Contact',
      content:
        'Have questions, feedback, or need support? Reach out to us at:\n\ninfo@toastbyte.studio\n\nWe welcome your suggestions and are here to help!',
    },
  ];

  const handleSectionPress = (sectionId: HelpSection) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback
        onPress={onClose}
        accessibilityLabel="Close help modal"
        accessibilityRole="button"
        accessibilityHint="Tap to dismiss the help"
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={preventClose}>
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: COLORS.PRIMARY_LIGHT,
                  borderColor: COLORS.TOAST_BROWN,
                },
              ]}
            >
              <View
                style={[
                  styles.header,
                  {
                    backgroundColor: COLORS.SECONDARY_ACCENT,
                    borderBottomColor: COLORS.TOAST_BROWN,
                  },
                ]}
              >
                <RNText
                  style={[styles.headerText, { color: COLORS.PRIMARY_DARK }]}
                >
                  Help
                </RNText>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityLabel="Close help"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="close-outline"
                    size={28}
                    color={COLORS.PRIMARY_DARK}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content}>
                {helpSections.map((section) => {
                  const shouldShowTutorialActions = section.id === 'how';
                  const hasTutorialActionHandlers = !!onLaunchTutorial;

                  return (
                    <View key={section.id} style={styles.accordionItem}>
                      <TouchableOpacity
                        style={[
                          styles.accordionHeader,
                          {
                            borderColor: COLORS.TOAST_BROWN,
                            backgroundColor: COLORS.BACKGROUND,
                          },
                          expandedSection === section.id && {
                            backgroundColor: COLORS.TOAST_BROWN,
                            borderColor: COLORS.PRIMARY_DARK,
                          },
                        ]}
                        onPress={() => handleSectionPress(section.id)}
                        accessibilityLabel={`${section.title} ${
                          expandedSection === section.id
                            ? 'expanded'
                            : 'collapsed'
                        }`}
                        accessibilityRole="button"
                        accessibilityHint={`Tap to ${
                          expandedSection === section.id ? 'collapse' : 'expand'
                        } ${section.title}`}
                      >
                        <RNText
                          style={[
                            styles.accordionTitle,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {section.title}
                        </RNText>
                        <Ionicons
                          name={
                            expandedSection === section.id
                              ? 'chevron-up-outline'
                              : 'chevron-down-outline'
                          }
                          size={24}
                          color={COLORS.PRIMARY_DARK}
                        />
                      </TouchableOpacity>
                      {expandedSection === section.id && (
                        <View
                          style={[
                            styles.accordionContent,
                            {
                              backgroundColor: COLORS.PRIMARY_LIGHT,
                              borderColor: COLORS.TOAST_BROWN,
                            },
                          ]}
                        >
                          <RNText
                            style={[
                              styles.accordionText,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            {renderLinkableText(section.content)}
                          </RNText>
                          {shouldShowTutorialActions &&
                            hasTutorialActionHandlers && (
                              <>
                                {onLaunchTutorial && (
                                  <TouchableOpacity
                                    style={[
                                      styles.tutorialActionButton,
                                      {
                                        backgroundColor:
                                          COLORS.SECONDARY_ACCENT,
                                      },
                                    ]}
                                    onPress={onLaunchTutorial}
                                    accessibilityLabel="Replay tutorial now"
                                    accessibilityRole="button"
                                  >
                                    <RNText
                                      style={[
                                        styles.tutorialActionButtonText,
                                        { color: COLORS.PRIMARY_DARK },
                                      ]}
                                    >
                                      Replay Tutorial
                                    </RNText>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

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
    height: '80%',
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
    paddingVertical: 16,
    borderBottomWidth: 2,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  accordionItem: {
    marginBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  accordionContent: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  accordionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    textDecorationLine: 'underline',
  },
  tutorialActionButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tutorialActionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
