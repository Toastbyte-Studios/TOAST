/**
 * @format
 * Tests for CoreStore category management functionality
 */

// Mock react-native-geolocation-service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((success, _error, _options) => {
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
            executeSql: (
              query: string,
              params?: Array<string | number | boolean | null>,
              success?: (tx: unknown, result: unknown) => void,
            ) => {
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

describe('NotesStore - Category Management', () => {
  let coreStore: NotesStore;

  beforeEach(() => {
    jest.clearAllMocks();
    coreStore = new NotesStore();
  });

  afterEach(() => {
    coreStore.dispose();
  });

  describe('addCategory', () => {
    it('should add a new category', async () => {
      await coreStore.addCategory('Work');

      expect(coreStore.categories).toContain('Work');
      expect(coreStore.categories).toHaveLength(1);
    });

    it('should add multiple categories', async () => {
      await coreStore.addCategory('Work');
      await coreStore.addCategory('Personal');
      await coreStore.addCategory('Ideas');

      expect(coreStore.categories).toContain('Work');
      expect(coreStore.categories).toContain('Personal');
      expect(coreStore.categories).toContain('Ideas');
      expect(coreStore.categories).toHaveLength(3);
    });

    it('should throw error when adding duplicate category', async () => {
      await coreStore.addCategory('Work');

      await expect(coreStore.addCategory('Work')).rejects.toThrow(
        'Category already exists',
      );
      expect(coreStore.categories).toHaveLength(1);
    });

    it('should throw error when adding duplicate category with different case', async () => {
      await coreStore.addCategory('Work');

      // Categories are case-insensitive, so 'work' should be treated as duplicate of 'Work'
      await expect(coreStore.addCategory('work')).rejects.toThrow(
        'Category already exists',
      );
      expect(coreStore.categories).toHaveLength(1);
      expect(coreStore.categories).toContain('Work');
    });

    it('should throw error when adding empty category name', async () => {
      await expect(coreStore.addCategory('')).rejects.toThrow(
        'Category name cannot be empty',
      );
      expect(coreStore.categories).toHaveLength(0);
    });

    it('should throw error when adding whitespace-only category name', async () => {
      await expect(coreStore.addCategory('   ')).rejects.toThrow(
        'Category name cannot be empty',
      );
      expect(coreStore.categories).toHaveLength(0);
    });

    it('should trim whitespace from category names', async () => {
      await coreStore.addCategory('  Work  ');

      expect(coreStore.categories).toContain('Work');
      expect(coreStore.categories).not.toContain('  Work  ');
    });

    it('should detect duplicate after trimming', async () => {
      await coreStore.addCategory('Work');

      await expect(coreStore.addCategory('  Work  ')).rejects.toThrow(
        'Category already exists',
      );
    });
  });

  describe('deleteCategory', () => {
    beforeEach(async () => {
      // Set up initial categories
      await coreStore.addCategory('General');
      await coreStore.addCategory('Work');
      await coreStore.addCategory('Personal');
    });

    it('should delete a category with no notes', async () => {
      await coreStore.deleteCategory('Work');

      expect(coreStore.categories).not.toContain('Work');
      expect(coreStore.categories).toHaveLength(2);
    });

    it('should throw error when deleting the last category', async () => {
      await coreStore.deleteCategory('Work');
      await coreStore.deleteCategory('Personal');

      // Only 'General' remains
      expect(coreStore.categories).toHaveLength(1);

      await expect(coreStore.deleteCategory('General')).rejects.toThrow(
        'Cannot delete the last category',
      );
      expect(coreStore.categories).toContain('General');
    });

    it('should throw error when deleting non-existent category', async () => {
      await expect(coreStore.deleteCategory('NonExistent')).rejects.toThrow(
        'Category does not exist',
      );
    });

    it('should reassign notes to fallback category when deleting', async () => {
      // Create a note in the 'Work' category
      await coreStore.createNote({
        type: 'text',
        title: 'Work Note',
        text: 'Some work content',
        category: 'Work',
      });

      expect(coreStore.notes[0].category).toBe('Work');

      // Delete 'Work' category with fallback to 'General'
      await coreStore.deleteCategory('Work', 'General');

      expect(coreStore.categories).not.toContain('Work');
      expect(coreStore.notes[0].category).toBe('General');
    });

    it('should reassign multiple notes when deleting category', async () => {
      // Create multiple notes in 'Work' category
      await coreStore.createNote({
        type: 'text',
        title: 'Work Note 1',
        text: 'Content 1',
        category: 'Work',
      });
      await coreStore.createNote({
        type: 'text',
        title: 'Work Note 2',
        text: 'Content 2',
        category: 'Work',
      });
      await coreStore.createNote({
        type: 'text',
        title: 'Personal Note',
        text: 'Personal content',
        category: 'Personal',
      });

      const workNotes = coreStore.notes.filter((n) => n.category === 'Work');
      expect(workNotes).toHaveLength(2);

      await coreStore.deleteCategory('Work', 'Personal');

      const reassignedNotes = coreStore.notes.filter(
        (n) => n.category === 'Personal',
      );
      expect(reassignedNotes).toHaveLength(3);
      expect(coreStore.notes.filter((n) => n.category === 'Work')).toHaveLength(
        0,
      );
    });

    it('should use default fallback category (General) when not specified', async () => {
      await coreStore.createNote({
        type: 'text',
        title: 'Work Note',
        text: 'Content',
        category: 'Work',
      });

      await coreStore.deleteCategory('Work');

      expect(coreStore.notes[0].category).toBe('General');
    });

    it('should handle deleting category when fallback category has notes', async () => {
      // Create notes in both categories
      await coreStore.createNote({
        type: 'text',
        title: 'General Note',
        text: 'General content',
        category: 'General',
      });
      await coreStore.createNote({
        type: 'text',
        title: 'Work Note',
        text: 'Work content',
        category: 'Work',
      });

      await coreStore.deleteCategory('Work', 'General');

      const generalNotes = coreStore.notes.filter(
        (n) => n.category === 'General',
      );
      expect(generalNotes).toHaveLength(2);
    });
  });

  describe('getCategoryNoteCount', () => {
    beforeEach(async () => {
      await coreStore.addCategory('General');
      await coreStore.addCategory('Work');
    });

    it('should return 0 for empty category', () => {
      expect(coreStore.getCategoryNoteCount('General')).toBe(0);
    });

    it('should return correct count for category with notes', async () => {
      await coreStore.createNote({
        type: 'text',
        title: 'Note 1',
        text: 'Content',
        category: 'Work',
      });
      await coreStore.createNote({
        type: 'text',
        title: 'Note 2',
        text: 'Content',
        category: 'Work',
      });

      expect(coreStore.getCategoryNoteCount('Work')).toBe(2);
      expect(coreStore.getCategoryNoteCount('General')).toBe(0);
    });

    it('should return 0 for non-existent category', () => {
      expect(coreStore.getCategoryNoteCount('NonExistent')).toBe(0);
    });
  });

  describe('createDefaultCategories', () => {
    it('should create default categories', async () => {
      await coreStore.createDefaultCategories();

      expect(coreStore.categories).toContain('General');
      expect(coreStore.categories).toContain('Work');
      expect(coreStore.categories).toContain('Personal');
      expect(coreStore.categories).toContain('Ideas');
      expect(coreStore.categories).toHaveLength(4);
    });

    it('should not duplicate categories if called twice', async () => {
      await coreStore.createDefaultCategories();

      // Second call should throw for each existing category
      // but continue adding others - depending on implementation
      // Let's test the end state
      try {
        await coreStore.createDefaultCategories();
      } catch {
        // Expected to throw for duplicates
      }

      // Should still have only 4 categories
      expect(coreStore.categories).toHaveLength(4);
    });
  });

  describe('edge cases', () => {
    it('should handle category with special characters', async () => {
      await coreStore.addCategory('Work & Life');

      expect(coreStore.categories).toContain('Work & Life');
    });

    it('should handle category with unicode characters', async () => {
      await coreStore.addCategory('工作');

      expect(coreStore.categories).toContain('工作');
    });

    it('should handle very long category name', async () => {
      const longName = 'A'.repeat(100);
      await coreStore.addCategory(longName);

      expect(coreStore.categories).toContain(longName);
    });

    it('should handle rapid add and delete operations', async () => {
      await coreStore.addCategory('Cat1');
      await coreStore.addCategory('Cat2');
      await coreStore.addCategory('Cat3');

      await coreStore.deleteCategory('Cat2');
      await coreStore.addCategory('Cat4');
      await coreStore.deleteCategory('Cat1');

      expect(coreStore.categories).toContain('Cat3');
      expect(coreStore.categories).toContain('Cat4');
      expect(coreStore.categories).not.toContain('Cat1');
      expect(coreStore.categories).not.toContain('Cat2');
    });

    it('should maintain note integrity when category is deleted and recreated', async () => {
      await coreStore.addCategory('General');
      await coreStore.addCategory('Temporary');

      await coreStore.createNote({
        type: 'text',
        title: 'Test Note',
        text: 'Content',
        category: 'Temporary',
      });

      const noteId = coreStore.notes[0].id;

      await coreStore.deleteCategory('Temporary', 'General');
      await coreStore.addCategory('Temporary');

      // Note should still exist but be in General
      const note = coreStore.notes.find((n) => n.id === noteId);
      expect(note).toBeDefined();
      expect(note?.category).toBe('General');
    });

    it('should handle deleting category that was the fallback in a previous delete', async () => {
      await coreStore.addCategory('Cat1');
      await coreStore.addCategory('Cat2');
      await coreStore.addCategory('Cat3');

      await coreStore.createNote({
        type: 'text',
        title: 'Note',
        text: 'Content',
        category: 'Cat1',
      });

      // Delete Cat1, fallback to Cat2
      await coreStore.deleteCategory('Cat1', 'Cat2');
      expect(coreStore.notes[0].category).toBe('Cat2');

      // Now delete Cat2, fallback to Cat3
      await coreStore.deleteCategory('Cat2', 'Cat3');
      expect(coreStore.notes[0].category).toBe('Cat3');
    });

    it('should not affect notes in other categories when deleting', async () => {
      await coreStore.addCategory('General');
      await coreStore.addCategory('Work');
      await coreStore.addCategory('Personal');

      await coreStore.createNote({
        type: 'text',
        title: 'General Note',
        text: 'Content',
        category: 'General',
      });
      await coreStore.createNote({
        type: 'text',
        title: 'Personal Note',
        text: 'Content',
        category: 'Personal',
      });

      await coreStore.deleteCategory('Work', 'General');

      // Other notes should be unaffected
      const generalNote = coreStore.notes.find(
        (n) => n.title === 'General Note',
      );
      const personalNote = coreStore.notes.find(
        (n) => n.title === 'Personal Note',
      );

      expect(generalNote?.category).toBe('General');
      expect(personalNote?.category).toBe('Personal');
    });
  });
});
