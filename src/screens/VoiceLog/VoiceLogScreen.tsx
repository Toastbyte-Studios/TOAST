import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  Vibration,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from 'react-native';
import {
  useSoundRecorder,
  // AudioEncoderAndroidType,
} from 'react-native-nitro-sound';
import Sound from 'react-native-sound';
import Icon from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useNotesStore } from '../../stores';
import { COLORS, FOOTER_HEIGHT, SCROLL_PADDING } from '../../theme';
import EmptyState from './components/EmptyState';
import InfoBox from './components/InfoBox';
import RecordingControls from './components/RecordingControls';
import VoiceLogCard from './components/VoiceLogCard';
import VoiceLogModeButton from './components/VoiceLogModeButton';

const MAX_DURATION_SECONDS = 12;

/**
 * Voice Log Screen
 *
 * Allows users to record short voice notes (max 12 seconds) with automatic metadata capture
 * or view and manage previously recorded voice logs.
 *
 * Features:
 * - One-tap recording with visual feedback
 * - Auto-stop at 12-second limit
 * - Haptic feedback on completion
 * - Automatic timestamp and location capture
 * - View, play, and delete saved voice logs
 * - Voice logs are stored separately from regular notes
 *
 * @returns A React element rendering the Voice Log screen.
 */
export default observer(function VoiceLogScreen() {
  const core = useNotesStore();
  const navigation = useNavigation();
  const [mode, setMode] = useState<'select' | 'record' | 'view'>('select');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const stopRecorderRef = useRef<(() => Promise<string | undefined>) | null>(
    null,
  );
  const isRecordingRef = useRef(false);
  const handleStopRecordingRef = useRef<(() => Promise<void>) | null>(null);

  // Update ref when recording state changes
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Stabilize handleStopRecording function reference using useCallback
  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    try {
      // Stop recording first - wrap in try/catch in case recorder isn't active
      let result: string | undefined;
      try {
        result = await stopRecorderRef.current?.();
      } catch (error) {
        console.warn('Error stopping recorder:', error);
        result = audioPath || undefined;
      }

      const duration = recordingTime;
      const audioUri = result || audioPath;

      // Validate audio path before changing state
      if (!audioUri) {
        Alert.alert('Error', 'Failed to record audio. Please try again.');
        setIsRecording(false);
        setRecordingTime(0);
        setAudioPath(null);
        return;
      }

      // Update state after successful recording stop
      setIsRecording(false);

      // Haptic feedback
      Vibration.vibrate(200);

      // Save voice log
      await core.createVoiceLog({
        audioUri: audioUri,
        duration: duration,
        transcription: undefined, // Transcription not implemented yet
      });

      // Show success message and navigate back
      Alert.alert('Saved', 'Voice log saved successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);

      setRecordingTime(0);
      setAudioPath(null);
    } catch (error) {
      console.error('Failed to save voice log:', error);
      Alert.alert('Error', 'Failed to save voice log. Please try again.');
      // Ensure recording state is reset even when saving fails
      setRecordingTime(0);
      setAudioPath(null);
    }
  }, [audioPath, recordingTime, core, navigation]);

  // Store handleStopRecording in ref for use in callback
  useEffect(() => {
    handleStopRecordingRef.current = handleStopRecording;
  }, [handleStopRecording]);

  // Initialize sound recorder
  const { startRecorder, stopRecorder } = useSoundRecorder({
    onRecord: (e) => {
      const currentTime = Math.floor(e.currentPosition / 1000);
      setRecordingTime(currentTime);

      // Auto-stop at max duration - use ref to avoid stale closure
      if (
        currentTime >= MAX_DURATION_SECONDS &&
        handleStopRecordingRef.current
      ) {
        handleStopRecordingRef.current();
      }
    },
  });

  // Store stopRecorder in ref for cleanup
  useEffect(() => {
    stopRecorderRef.current = stopRecorder;
  }, [stopRecorder]);

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      // Stop active recording if component unmounts
      if (isRecordingRef.current && stopRecorderRef.current) {
        stopRecorderRef.current().catch((err) => {
          console.warn('Error stopping recorder on unmount:', err);
        });
      }

      // Stop playback when unmounting
      if (soundRef.current) {
        soundRef.current.stop(() => {
          soundRef.current?.release();
          soundRef.current = null;
        });
      }
    };
  }, []); // Empty dependency array for unmount-only cleanup

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return true; // iOS permissions handled by Info.plist
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Audio Recording Permission',
          message:
            'This app needs access to your microphone to record voice logs.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const handleStartRecording = async () => {
    try {
      // Request permission on Android
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record audio.',
        );
        return;
      }

      setIsRecording(true);
      setRecordingTime(0);

      // Start recording - library uses default writable cache directory
      const path = await startRecorder();

      setAudioPath(path);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const progress = recordingTime / MAX_DURATION_SECONDS;

  // Get only voice logs from notes
  const voiceLogs = core.notes.filter((note) => note.category === 'Voice Logs');

  const handlePlayVoiceLog = (noteId: string, audioUri: string) => {
    try {
      // Stop any currently playing sound
      if (soundRef.current) {
        soundRef.current.stop(() => {
          soundRef.current?.release();
          soundRef.current = null;
        });
        setPlayingId(null);
        return;
      }

      // Start playing new sound
      setPlayingId(noteId);

      // Load audio file
      const sound = new Sound(audioUri, '', (error) => {
        if (error) {
          console.error('Failed to load sound:', error);
          Alert.alert('Error', 'Failed to load audio file.');
          sound.release();
          setPlayingId(null);
          return;
        }

        // Play the sound
        sound.play((success) => {
          if (success) {
            setPlayingId(null);
          } else {
            console.error('Failed to play sound');
            Alert.alert('Error', 'Failed to play audio.');
            setPlayingId(null);
          }

          // Release sound resources after playback completes
          sound.release();
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        });

        soundRef.current = sound;
      });
    } catch (error) {
      console.error('Error playing voice log:', error);
      Alert.alert('Error', 'Failed to play voice log.');
      setPlayingId(null);
    }
  };

  const handleDeleteVoiceLog = (noteId: string) => {
    Alert.alert(
      'Delete Voice Log',
      'Are you sure you want to delete this voice log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Stop playing if this is the currently playing log
            if (playingId === noteId && soundRef.current) {
              soundRef.current.stop(() => {
                soundRef.current?.release();
                soundRef.current = null;
              });
              setPlayingId(null);
            }
            core.deleteNote(noteId);
          },
        },
      ],
    );
  };

  // Mode: Select recording or viewing
  if (mode === 'select') {
    return (
      <ScreenBody>
        <SectionHeader>Voice Logs</SectionHeader>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.modeSelectionTitle}>
            What would you like to do?
          </Text>

          <VoiceLogModeButton
            icon="mic"
            title="Record Voice Log"
            subtitle="Create a new voice note"
            onPress={() => {
              setMode('record');
              setRecordingTime(0);
              setAudioPath(null);
            }}
            accessibilityLabel="Record Voice Log"
          />

          <VoiceLogModeButton
            icon="list"
            title="View Voice Logs"
            subtitle={`${voiceLogs.length} saved ${voiceLogs.length === 1 ? 'log' : 'logs'}`}
            onPress={() => setMode('view')}
            accessibilityLabel="View Voice Logs"
          />
        </ScrollView>
      </ScreenBody>
    );
  }

  // Mode: Record
  if (mode === 'record') {
    return (
      <ScreenBody>
        <SectionHeader>Record Voice Log</SectionHeader>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <InfoBox icon="information-circle-outline">
            <Text style={styles.infoText}>
              Tap to record a voice note.{'\n'}
              Maximum duration: {MAX_DURATION_SECONDS} seconds.
            </Text>
          </InfoBox>

          <RecordingControls
            isRecording={isRecording}
            recordingTime={recordingTime}
            progress={progress}
            maxDuration={MAX_DURATION_SECONDS}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />

          <InfoBox icon="time-outline">
            <View>
              <Text style={styles.featuresTitle}>Auto-captured metadata:</Text>
              <View style={styles.featureRow}>
                <Icon
                  name="time-outline"
                  size={16}
                  color={COLORS.PRIMARY_DARK}
                />
                <Text style={styles.featureText}>Timestamp</Text>
              </View>
              <View style={styles.featureRow}>
                <Icon
                  name="location-outline"
                  size={16}
                  color={COLORS.PRIMARY_DARK}
                />
                <Text style={styles.featureText}>
                  GPS Location (if available)
                </Text>
              </View>
            </View>
          </InfoBox>
        </ScrollView>
      </ScreenBody>
    );
  }

  // Mode: View
  return (
    <ScreenBody>
      <SectionHeader>Voice Logs</SectionHeader>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {voiceLogs.length === 0 ? (
          <EmptyState
            icon="mic-off-outline"
            title="No voice logs yet"
            subtitle="Record your first voice log to get started"
          />
        ) : (
          <View style={styles.voiceLogsList}>
            {voiceLogs.map((log) => (
              <VoiceLogCard
                key={log.id}
                title={log.title}
                createdAt={log.createdAt}
                duration={log.duration}
                audioUri={log.audioUri}
                isPlaying={playingId === log.id}
                onPlay={() => handlePlayVoiceLog(log.id, log.audioUri!)}
                onDelete={() => handleDeleteVoiceLog(log.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SCROLL_PADDING,
    paddingHorizontal: 16,
    paddingBottom: FOOTER_HEIGHT + SCROLL_PADDING,
  },
  modeSelectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.PRIMARY_DARK,
    marginBottom: 30,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.PRIMARY_DARK,
    lineHeight: 20,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.PRIMARY_DARK,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.PRIMARY_DARK,
    marginLeft: 8,
  },
  voiceLogsList: {
    width: '100%',
  },
});
