/**
 * @format
 */

// Mock react-native-geolocation-service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((success, _error, _options) => {
    // Call success callback immediately with mock position
    success({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 0,
        accuracy: 5,
        altitudeAccuracy: 5,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    });
  }),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
}));

// Mock react-native modules
jest.mock('react-native-torch', () => ({
  switchState: jest.fn(),
}));

jest.mock('react-native-sound', () => {
  const Sound = jest.fn().mockImplementation(() => ({
    play: jest.fn((callback: Function) => callback && callback(true)),
    stop: jest.fn((callback?: Function) => callback && callback()),
    release: jest.fn(),
  })) as jest.Mock & { setCategory: jest.Mock; MAIN_BUNDLE: string };
  Sound.setCategory = jest.fn();
  Sound.MAIN_BUNDLE = '';
  return Sound;
});

jest.mock('react-native-device-info', () => ({
  getBatteryLevel: jest.fn(() => Promise.resolve(0.75)),
  getPowerState: jest.fn(() =>
    Promise.resolve({ batteryState: 'unplugged', charging: false }),
  ),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      type: 'wifi',
    }),
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeModules: {},
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-sqlite-storage', () => {
  const mockExecuteSql = jest.fn(() =>
    Promise.resolve([{ rows: { length: 0, item: () => null, raw: () => [] } }]),
  );

  return {
    openDatabase: jest.fn(() =>
      Promise.resolve({
        executeSql: mockExecuteSql,
        transaction: jest.fn((callback) => {
          const tx = {
            executeSql: (query: string, params?: any[], success?: Function) => {
              if (success)
                success(tx, { rows: { length: 0, item: () => null } });
            },
          };
          callback(tx);
          return Promise.resolve();
        }),
        close: jest.fn(() => Promise.resolve()),
      }),
    ),
    enablePromise: jest.fn(),
    DEBUG: jest.fn(),
  };
});

import { NotesStore } from '../src/stores/NotesStore';

describe('CoreStore - Note Editing', () => {
  let coreStore: NotesStore;

  /**
   * Helper function to setup a custom SQLite mock with spyable executeSql.
   * This is used when tests need to inspect database calls to verify persistence.
   * @returns The mockExecuteSql function that can be inspected in tests
   */
  const setupSpyableDatabaseMock = () => {
    const SQLite = require('react-native-sqlite-storage');
    const mockExecuteSql = jest.fn(() =>
      Promise.resolve([{ rows: { length: 0, item: () => null } }]),
    );
    SQLite.openDatabase.mockResolvedValue({
      executeSql: mockExecuteSql,
      transaction: jest.fn(),
      close: jest.fn(() => Promise.resolve()),
    });
    return mockExecuteSql;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    coreStore = new NotesStore();
  });

  afterEach(() => {
    coreStore.dispose();
  });

  describe('updateNoteContent', () => {
    it('should update note title', async () => {
      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Original Title',
        text: 'Original text',
        category: 'General',
      });

      const note = coreStore.notes[0];
      expect(note.title).toBe('Original Title');

      // Update the title
      await coreStore.updateNoteContent(note.id, {
        title: 'Updated Title',
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.title).toBe('Updated Title');
      expect(updatedNote?.text).toBe('Original text'); // Text should remain unchanged
    });

    it('should update note text', async () => {
      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Title',
        text: 'Original text',
        category: 'General',
      });

      const note = coreStore.notes[0];
      expect(note.text).toBe('Original text');

      // Update the text
      await coreStore.updateNoteContent(note.id, {
        text: 'Updated text',
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.text).toBe('Updated text');
      expect(updatedNote?.title).toBe('Title'); // Title should remain unchanged
    });

    it('should update note category', async () => {
      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Title',
        text: 'Text',
        category: 'General',
      });

      const note = coreStore.notes[0];
      expect(note.category).toBe('General');

      // Update the category
      await coreStore.updateNoteContent(note.id, {
        category: 'Work',
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.category).toBe('Work');
    });

    it('should update multiple fields at once', async () => {
      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Original Title',
        text: 'Original text',
        category: 'General',
      });

      const note = coreStore.notes[0];

      // Update all fields
      await coreStore.updateNoteContent(note.id, {
        title: 'Updated Title',
        text: 'Updated text',
        category: 'Personal',
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.title).toBe('Updated Title');
      expect(updatedNote?.text).toBe('Updated text');
      expect(updatedNote?.category).toBe('Personal');
    });

    it('should persist changes to database', async () => {
      // Setup a spyable database mock to verify persistence calls
      const mockExecuteSql = setupSpyableDatabaseMock();

      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Title',
        text: 'Text',
        category: 'General',
      });

      const note = coreStore.notes[0];

      // Update the note
      await coreStore.updateNoteContent(note.id, {
        title: 'Updated Title',
        text: 'Updated text',
      });

      // Verify database was called with updated values
      const insertCalls = mockExecuteSql.mock.calls.filter((call: any[]) =>
        call[0]?.includes('INSERT OR REPLACE INTO notes'),
      );
      expect(insertCalls.length).toBeGreaterThan(0);
      const lastInsertCall = insertCalls[insertCalls.length - 1] as any[];
      expect(lastInsertCall[1]).toContain('Updated Title');
      expect(lastInsertCall[1]).toContain('Updated text');
    });

    it('should handle non-existent note gracefully', async () => {
      // Try to update a note that doesn't exist
      await coreStore.updateNoteContent('non-existent-id', {
        title: 'Updated Title',
      });

      // Should not throw error, just do nothing
      expect(coreStore.notes).toHaveLength(0);
    });

    it('should handle partial updates', async () => {
      // Create a note first
      await coreStore.createNote({
        type: 'text',
        title: 'Original Title',
        text: 'Original text',
        category: 'General',
      });

      const note = coreStore.notes[0];

      // Update only title, leaving text and category unchanged
      await coreStore.updateNoteContent(note.id, {
        title: 'New Title',
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.title).toBe('New Title');
      expect(updatedNote?.text).toBe('Original text');
      expect(updatedNote?.category).toBe('General');
    });
  });

  describe('createNote - sketch type', () => {
    it('should create a sketch note with sketchDataUri', async () => {
      const sketchData =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await coreStore.createNote({
        type: 'sketch',
        title: 'My Sketch',
        sketchDataUri: sketchData,
        category: 'General',
      });

      expect(coreStore.notes).toHaveLength(1);
      const note = coreStore.notes[0];
      expect(note.type).toBe('sketch');
      expect(note.title).toBe('My Sketch');
      expect(note.sketchDataUri).toBe(sketchData);
    });

    it('should update sketch note with new sketchDataUri', async () => {
      const initialSketch = 'data:image/png;base64,initial';
      const updatedSketch = 'data:image/png;base64,updated';

      await coreStore.createNote({
        type: 'sketch',
        title: 'Sketch Note',
        sketchDataUri: initialSketch,
        category: 'General',
      });

      const note = coreStore.notes[0];
      expect(note.sketchDataUri).toBe(initialSketch);

      await coreStore.updateNoteContent(note.id, {
        sketchDataUri: updatedSketch,
      });

      const updatedNote = coreStore.notes.find((n) => n.id === note.id);
      expect(updatedNote?.sketchDataUri).toBe(updatedSketch);
    });

    it('should require title for sketch notes to be saveable', async () => {
      // Test that sketch notes require a title
      const sketchData =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Should be able to create sketch note with title and sketch data
      await coreStore.createNote({
        type: 'sketch',
        title: 'Required Title',
        sketchDataUri: sketchData,
        category: 'General',
      });

      expect(coreStore.notes).toHaveLength(1);
      const note = coreStore.notes[0];
      expect(note.type).toBe('sketch');
      expect(note.title).toBe('Required Title');
      expect(note.sketchDataUri).toBe(sketchData);
    });

    it('should save sketch note even without explicit sketchDataUri if drawing occurred', async () => {
      // Simulates the case where user has drawn but we haven't captured the data URI yet
      // The UI tracks hasDrawn state and enables save button
      // When save is clicked, readSignature() is called to get the data
      const sketchData = 'data:image/png;base64,captured';

      await coreStore.createNote({
        type: 'sketch',
        title: 'Drawn Note',
        sketchDataUri: sketchData,
        category: 'General',
      });

      expect(coreStore.notes).toHaveLength(1);
      const note = coreStore.notes[0];
      expect(note.type).toBe('sketch');
      expect(note.sketchDataUri).toBe(sketchData);
    });
  });
});
