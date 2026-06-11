import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import React, { JSX, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HorizontalRule } from '../../components/HorizontalRule';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import { useTheme } from '../../hooks/useTheme';
import {
  useChecklistStore,
  useCoreStore,
  useInventoryStore,
  usePantryStore,
} from '../../stores';
import { Checklist } from '../../stores/ChecklistStore';
import { Note } from '../../stores/CoreStore';
import { FOOTER_HEIGHT } from '../../theme';
import ReferenceEntryType from '../../types/data-type';
import { RagResult, ragSearch } from '../../utils/ragSearch';
import { SearchableItem, searchItems } from '../../utils/searchData';

type SearchScreenNavigationProp = NativeStackNavigationProp<{
  ComingSoon: { title: string; icon: string };
  Entry: { entry: ReferenceEntryType };
  NoteEntry: { note: Note };
  ChecklistEntry: { checklist: Checklist };
  InventoryCategory: { category: string };
  PantryCategory: { category: string };
  // Screens navigated to via synthetic RAG entry related_screen
  MorseCode: undefined;
  NatoPhonetic: undefined;
  RadioFrequencies: undefined;
  GroundToAirSignals: undefined;
  DigitalWhistle: undefined;
  UnitConversion: undefined;
  LunarCycles: undefined;
  BarometricPressure: undefined;
  SunTime: undefined;
  DeviceStatus: undefined;
  Flashlight: undefined;
  VoiceLog: undefined;
  DecibelMeter: undefined;
  MapScreen: undefined;
  StarMap: undefined;
  EmergencyPlan: undefined;
  [key: string]: undefined | object;
}>;

type MessageRole = 'user' | 'assistant';

interface SearchMessage {
  id: string;
  role: MessageRole;
  text: string;
  ragResults?: RagResult[];
  userDataResults?: SearchableItem[];
}

const WELCOME_MESSAGE: SearchMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Search TOAST or ask a question — I\'ll find relevant content.\n\nTry: "fire starting", "signal aircraft", or "72-hour kit".',
};

/**
 * SearchScreen is a unified conversational search interface that handles both
 * keyword and natural language queries in a single chat-style experience.
 *
 * Features:
 * - Chat-style message history for the session
 * - On-device RAG (TF-IDF) for reference content — fully offline
 * - Keyword search for user data (notes, checklists, inventory, pantry)
 * - "Jump to full section" navigation links on reference results
 * - Graceful "nothing found" message
 * - Existing keyword search and reference browsing are unaffected
 */
export default observer(function SearchScreen(): JSX.Element {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const COLORS = useTheme();
  const checklistStore = useChecklistStore();
  const coreStore = useCoreStore();
  const inventoryStore = useInventoryStore();
  const pantryStore = usePantryStore();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<SearchMessage[]>([WELCOME_MESSAGE]);
  const [isSearching, setIsSearching] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasQuery = query.trim().length > 0;
  // Tracks the Y offset of each message within the scroll content for targeted scrolling
  const messageLayouts = useRef<Map<string, number>>(new Map());
  // Holds the ID of the most recent user message so we can scroll back to it
  const latestUserMsgId = useRef<string | null>(null);
  // Tracks pending timeouts so they can be cancelled if the screen unmounts
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current = [];
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;

    const userMsgId = `user-${Date.now()}`;
    latestUserMsgId.current = userMsgId;

    const userMessage: SearchMessage = {
      id: userMsgId,
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsSearching(true);

    // Defer the synchronous search to the next event-loop tick so the user
    // message bubble appears in the chat before the results are computed.
    const outerTimer = setTimeout(() => {
      // RAG search for reference content (offline, on-device)
      const ragResponse = ragSearch(trimmed);

      // Keyword search for user data — exclude reference/tool/module (RAG covers those)
      const allResults = searchItems(
        trimmed,
        coreStore.notes,
        checklistStore.checklists,
        checklistStore.checklistItems,
        inventoryStore.items,
        pantryStore.items,
      );
      const userDataResults = allResults.filter(
        (item) => !['reference', 'tool', 'module'].includes(item.type),
      );

      const hasRag = ragResponse.hasResults;
      const hasUserData = userDataResults.length > 0;

      let responseText: string;
      if (!hasRag && !hasUserData) {
        responseText = `Nothing found for "${trimmed}". Try different keywords or rephrase your question.`;
      } else {
        const parts: string[] = [];
        if (hasRag) {
          const count = ragResponse.results.length;
          parts.push(
            count === 1
              ? 'Found 1 reference section:'
              : `Found ${count} reference sections:`,
          );
        }
        if (hasUserData) {
          const count = userDataResults.length;
          parts.push(
            count === 1
              ? 'Also found 1 match in your data:'
              : `Also found ${count} matches in your data:`,
          );
        }
        responseText = parts.join(' ');
      }

      const assistantMessage: SearchMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: responseText,
        ragResults: hasRag ? ragResponse.results : [],
        userDataResults: hasUserData ? userDataResults : [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsSearching(false);

      // Scroll to the user's question so they see it at the top and can scroll
      // down through the (potentially long) response at their own pace.
      const scrollTimer = setTimeout(() => {
        const msgId = latestUserMsgId.current;
        if (msgId !== null) {
          const y = messageLayouts.current.get(msgId);
          if (y !== undefined) {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, y - 8),
              animated: true,
            });
            return;
          }
        }
        // Fallback: scroll to end if layout not yet available
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      timeoutIds.current.push(scrollTimer);
    }, 0);
    timeoutIds.current.push(outerTimer);
  }, [
    checklistStore,
    query,
    isSearching,
    coreStore,
    inventoryStore,
    pantryStore,
  ]);

  const handleItemPress = useCallback(
    (item: SearchableItem) => {
      if (item.screen === 'ComingSoon') {
        navigation.navigate('ComingSoon', {
          title: item.title,
          icon: item.icon,
        });
      } else if (item.screen === 'Entry') {
        navigation.navigate('Entry', item.data);
      } else if (item.screen === 'NoteEntry') {
        navigation.navigate('NoteEntry', item.data);
      } else if (item.screen === 'ChecklistEntry') {
        navigation.navigate('ChecklistEntry', item.data);
      } else if (item.screen === 'InventoryCategory') {
        navigation.navigate('InventoryCategory', item.data);
      } else if (item.screen === 'PantryCategory') {
        navigation.navigate('PantryCategory', item.data);
      } else {
        navigation.navigate(item.screen);
      }
    },
    [navigation],
  );

  const handleJumpToEntry = useCallback(
    (entry: ReferenceEntryType) => {
      if (entry.related_screen) {
        navigation.navigate(
          entry.related_screen as
            | 'MorseCode'
            | 'NatoPhonetic'
            | 'RadioFrequencies'
            | 'GroundToAirSignals'
            | 'DigitalWhistle'
            | 'UnitConversion'
            | 'LunarCycles'
            | 'BarometricPressure'
            | 'SunTime'
            | 'DeviceStatus'
            | 'Flashlight'
            | 'VoiceLog'
            | 'DecibelMeter'
            | 'MapScreen'
            | 'StarMap'
            | 'EmergencyPlan',
        );
      } else {
        navigation.navigate('Entry', { entry });
      }
    },
    [navigation],
  );

  const renderRagResultCard = useCallback(
    (result: RagResult, index: number) => (
      <View
        key={result.entry.id}
        style={[
          styles.resultCard,
          {
            backgroundColor: COLORS.SECONDARY_ACCENT + '33',
            borderColor: COLORS.TOAST_BROWN,
          },
        ]}
      >
        <Text
          style={[styles.resultTitle, { color: COLORS.PRIMARY_DARK }]}
          numberOfLines={2}
        >
          {index + 1}. {result.entry.title}
        </Text>
        <Text style={[styles.resultCategory, { color: COLORS.PRIMARY_DARK }]}>
          {result.entry.category}
        </Text>
        <Text
          style={[styles.resultExcerpt, { color: COLORS.PRIMARY_DARK }]}
          numberOfLines={6}
        >
          {result.excerpt}
        </Text>
        <TouchableOpacity
          style={[styles.jumpButton, { backgroundColor: COLORS.TOAST_BROWN }]}
          onPress={() => handleJumpToEntry(result.entry)}
          accessibilityLabel={`Jump to full section: ${result.entry.title}`}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-forward-circle-outline"
            size={16}
            color={COLORS.PRIMARY_LIGHT}
          />
          <Text
            style={[styles.jumpButtonText, { color: COLORS.PRIMARY_LIGHT }]}
          >
            {result.entry.related_screen_label ?? 'Jump to full section'}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [COLORS, handleJumpToEntry],
  );

  const renderUserDataResult = useCallback(
    (item: SearchableItem) => (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.userDataItem,
          {
            backgroundColor: COLORS.SECONDARY_ACCENT + '22',
            borderColor: COLORS.TOAST_BROWN + '88',
          },
        ]}
        onPress={() => handleItemPress(item)}
        accessibilityLabel={`Open ${item.title}`}
        accessibilityRole="button"
      >
        <Ionicons
          name={item.icon}
          size={16}
          color={COLORS.PRIMARY_DARK}
          style={styles.userDataIcon}
        />
        <Text
          style={[styles.userDataText, { color: COLORS.PRIMARY_DARK }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Ionicons
          name="chevron-forward-outline"
          size={14}
          color={COLORS.PRIMARY_DARK}
        />
      </TouchableOpacity>
    ),
    [COLORS, handleItemPress],
  );

  const renderMessage = useCallback(
    (message: SearchMessage) => {
      const isUser = message.role === 'user';

      return (
        <View
          key={message.id}
          onLayout={(e) =>
            messageLayouts.current.set(message.id, e.nativeEvent.layout.y)
          }
          style={[
            styles.messageRow,
            isUser ? styles.messageRowUser : styles.messageRowAssistant,
          ]}
        >
          {!isUser && (
            <View
              style={[
                styles.avatarBubble,
                { backgroundColor: COLORS.TOAST_BROWN },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={13}
                color={COLORS.PRIMARY_LIGHT}
              />
            </View>
          )}
          <View style={styles.messageBubbleWrapper}>
            <View
              style={[
                styles.messageBubble,
                isUser
                  ? [styles.userBubble, { backgroundColor: COLORS.TOAST_BROWN }]
                  : [
                      styles.assistantBubble,
                      {
                        backgroundColor: COLORS.SECONDARY_ACCENT + '55',
                        borderColor: COLORS.TOAST_BROWN + '88',
                      },
                    ],
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: isUser ? COLORS.PRIMARY_LIGHT : COLORS.PRIMARY_DARK,
                  },
                ]}
              >
                {message.text}
              </Text>
            </View>

            {/* RAG reference result cards */}
            {!isUser &&
              message.ragResults &&
              message.ragResults.length > 0 &&
              message.ragResults.map((result, i) =>
                renderRagResultCard(result, i),
              )}

            {/* User data results */}
            {!isUser &&
              message.userDataResults &&
              message.userDataResults.length > 0 && (
                <View
                  style={[
                    styles.userDataList,
                    {
                      borderColor: COLORS.TOAST_BROWN + '55',
                    },
                  ]}
                >
                  {message.userDataResults.map(renderUserDataResult)}
                </View>
              )}
          </View>
        </View>
      );
    },
    [COLORS, renderRagResultCard, renderUserDataResult],
  );

  return (
    <ScreenBody>
      {/* Outer container provides footer clearance */}
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Input bar — top of screen, styled like SectionHeader */}
          <View style={styles.inputWrapper}>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: COLORS.SECONDARY_ACCENT,
                  borderColor: COLORS.TOAST_BROWN,
                },
              ]}
            >
              <TextInput
                style={[styles.textInput, { color: COLORS.PRIMARY_DARK }]}
                placeholder="Search or ask a question…"
                placeholderTextColor={COLORS.PRIMARY_DARK + '80'}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline={false}
                editable={!isSearching}
                autoFocus
                accessibilityLabel="Search or ask a question"
              />
              {hasQuery && (
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    { backgroundColor: COLORS.TOAST_BROWN },
                  ]}
                  onPress={handleSend}
                  disabled={isSearching}
                  accessibilityLabel="Send"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="send"
                    size={16}
                    color={COLORS.PRIMARY_LIGHT}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <HorizontalRule />

          {/* Message history */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: false })
            }
          >
            {messages.map(renderMessage)}

            {isSearching && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View
                  style={[
                    styles.avatarBubble,
                    { backgroundColor: COLORS.TOAST_BROWN },
                  ]}
                >
                  <Ionicons
                    name="search-outline"
                    size={13}
                    color={COLORS.PRIMARY_LIGHT}
                  />
                </View>
                <View
                  style={[
                    styles.messageBubble,
                    styles.assistantBubble,
                    {
                      backgroundColor: COLORS.SECONDARY_ACCENT + '55',
                      borderColor: COLORS.TOAST_BROWN + '88',
                    },
                  ]}
                >
                  <ActivityIndicator
                    size="small"
                    color={COLORS.PRIMARY_DARK}
                    accessibilityLabel="Searching"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingBottom: FOOTER_HEIGHT,
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  // Input is positioned at the top, styled to match SectionHeader
  inputWrapper: {
    width: '80%',
    alignSelf: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    padding: 0,
    minHeight: 28,
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
    flexShrink: 0,
  },
  messageBubbleWrapper: {
    flex: 1,
    maxWidth: '85%',
    gap: 6,
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  assistantBubble: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  resultCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultCategory: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    marginBottom: 4,
  },
  resultExcerpt: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
  },
  jumpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  jumpButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  userDataList: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  userDataIcon: {
    flexShrink: 0,
  },
  userDataText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
