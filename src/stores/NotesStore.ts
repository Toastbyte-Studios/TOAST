import { makeAutoObservable, runInAction, computed, comparer } from 'mobx';
import Geolocation from 'react-native-geolocation-service';
import { SQLiteDatabase } from '../types/database-types';
import { SQLiteStatic } from '../types/react-native-sqlite-storage';
import {
  Migration,
  getTableColumns,
  getTableDDL,
  runMigrations,
} from '../utils/dbMigrations';
import { formatTime } from '../utils/timeFormat';

let SQLite: SQLiteStatic | null = null;
try {
  SQLite = require('react-native-sqlite-storage');
} catch {
  // intentionally ignored: react-native-sqlite-storage is a native module that
  // may be unavailable in test/non-native environments
}

// ─── Notes / categories migrations ───────────────────────────────────────────

const NOTE_MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Create notes table with full current schema',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS notes (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'latitude REAL,' +
          'longitude REAL,' +
          'category TEXT NOT NULL,' +
          "type TEXT NOT NULL CHECK(type IN ('text','sketch','voice'))," +
          'title TEXT,' +
          'text TEXT,' +
          'bookmarked INTEGER DEFAULT 0,' +
          'sketchDataUri TEXT,' +
          'photoUris TEXT,' +
          'audioUri TEXT,' +
          'transcription TEXT,' +
          'duration REAL' +
          ')',
      );
    },
  },
  {
    id: 2,
    description: 'Create categories table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS categories (' +
          'name TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL' +
          ')',
      );
    },
  },
  {
    id: 3,
    description:
      'Add missing notes columns for databases created before voice-log support',
    run: async (db) => {
      const columns = await getTableColumns(db, 'notes');
      if (!columns.has('title')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN title TEXT');
      }
      if (!columns.has('bookmarked')) {
        await db.executeSql(
          'ALTER TABLE notes ADD COLUMN bookmarked INTEGER DEFAULT 0',
        );
      }
      if (!columns.has('audioUri')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN audioUri TEXT');
      }
      if (!columns.has('transcription')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN transcription TEXT');
      }
      if (!columns.has('duration')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN duration REAL');
      }
    },
  },
  {
    id: 4,
    description:
      "Rebuild notes table to add 'voice' to the type CHECK constraint",
    run: async (db) => {
      const ddl = await getTableDDL(db, 'notes');
      // Nothing to do if the table does not exist yet or already has voice support.
      if (!ddl || ddl.includes("'voice'")) return;

      await db.executeSql('ALTER TABLE notes RENAME TO notes_old');
      await db.executeSql(
        'CREATE TABLE notes (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'latitude REAL,' +
          'longitude REAL,' +
          'category TEXT NOT NULL,' +
          "type TEXT NOT NULL CHECK(type IN ('text','sketch','voice'))," +
          'title TEXT,' +
          'text TEXT,' +
          'bookmarked INTEGER DEFAULT 0,' +
          'sketchDataUri TEXT,' +
          'photoUris TEXT,' +
          'audioUri TEXT,' +
          'transcription TEXT,' +
          'duration REAL' +
          ')',
      );
      await db.executeSql(
        'INSERT INTO notes (' +
          'id,createdAt,latitude,longitude,category,type,' +
          'title,text,bookmarked,sketchDataUri,photoUris,' +
          'audioUri,transcription,duration' +
          ') SELECT ' +
          'id,createdAt,latitude,longitude,category,type,' +
          'title,text,bookmarked,sketchDataUri,photoUris,' +
          'audioUri,transcription,duration' +
          ' FROM notes_old',
      );
      await db.executeSql('DROP TABLE notes_old');
    },
  },
];

export type NoteInputType = 'text' | 'sketch' | 'voice';
// NoteCategory is now a string since categories are dynamic
// 'Voice Logs' is still supported for Voice Log feature, but not shown in NotePad
export type NoteCategory = string;

export interface Note {
  id: string;
  createdAt: number; // epoch ms
  latitude?: number;
  longitude?: number;
  category: NoteCategory;
  type: NoteInputType; // text, sketch, or voice
  title?: string;
  text?: string;
  bookmarked?: boolean;
  sketchDataUri?: string; // placeholder for sketch image
  photoUris: string[]; // attached photos (uris)
  audioUri?: string; // for voice logs
  transcription?: string; // for voice logs
  duration?: number; // recording duration in seconds for voice logs
}

export class NotesStore {
  // --------------------------------------------------------------------
  // ===== State =====
  // --------------------------------------------------------------------
  notes: Note[] = [];
  // NotePad categories - Voice Logs is separate and managed by Voice Log feature
  // Categories are now dynamic and stored in the database
  categories: string[] = [];
  notesDb: SQLiteDatabase | null = null;

  constructor() {
    makeAutoObservable(
      this,
      {
        notesByCategory: computed({ equals: comparer.structural }),
      },
      { autoBind: true },
    );
  }

  private generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // --------------------------------------------------------------------
  // ===== Note CRUD =====
  // --------------------------------------------------------------------

  /**
   * Creates a new note with optional geolocation data.
   *
   * Attempts to request the user's current location (if permission is granted)
   * and includes latitude and longitude in the note if available. The note is
   * then added to the store and persisted.
   *
   * @param params - The parameters for creating the note.
   * @param params.category - The category of the note (optional, defaults to 'General').
   * @param params.type - The type of input for the note.
   * @param params.title - The title of the note (optional).
   * @param params.text - The text content of the note (optional).
   * @param params.sketchDataUri - The data URI for a sketch associated with the note (optional).
   * @param params.photoUris - An array of URIs for photos attached to the note (optional).
   *
   * @returns A promise that resolves when the note has been created and persisted.
   */
  async createNote(params: {
    category?: NoteCategory;
    type: NoteInputType;
    title?: string;
    text?: string;
    sketchDataUri?: string;
    photoUris?: string[];
  }) {
    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        await new Promise<void>((resolve) => {
          Geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
          );
        });
      }
    } catch {
      // Location unavailable, proceed without it
    }

    const note: Note = {
      id: this.generateId(),
      createdAt: Date.now(),
      ...(latitude !== undefined &&
        longitude !== undefined && { latitude, longitude }),
      category: params.category ?? 'General',
      type: params.type,
      title: params.title,
      text: params.text,
      bookmarked: false,
      sketchDataUri: params.sketchDataUri,
      photoUris: params.photoUris || [],
    };

    runInAction(() => {
      this.notes.unshift(note);
    });
    await this.persistNote(note);
  }

  /**
   * Creates a voice log note with audio recording.
   *
   * Attempts to capture current location and creates a note entry with the provided
   * audio file URI. The note is categorized as "Voice Logs" and includes metadata
   * such as timestamp, location (if available), and audio duration.
   *
   * @param params - The parameters for creating the voice log.
   * @param params.audioUri - The file URI of the recorded audio.
   * @param params.duration - The duration of the recording in seconds.
   * @param params.transcription - Optional transcription text (if available).
   *
   * @returns A promise that resolves when the voice log has been created and persisted.
   */
  async createVoiceLog(params: {
    audioUri: string;
    duration: number;
    transcription?: string;
  }) {
    let latitude: number | undefined;
    let longitude: number | undefined;

    // Try to get current location with a shorter timeout for voice logs
    try {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        await new Promise<void>((resolve) => {
          Geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          );
        });
      }
    } catch {
      // Location unavailable, proceed without it
    }

    const now = Date.now();
    const timeStr = formatTime(new Date(now));

    const note: Note = {
      id: this.generateId(),
      createdAt: now,
      ...(latitude !== undefined &&
        longitude !== undefined && { latitude, longitude }),
      category: 'Voice Logs',
      type: 'voice',
      title: `Voice Log – ${timeStr}`,
      text: params.transcription ?? 'Audio only',
      bookmarked: false,
      sketchDataUri: undefined,
      photoUris: [],
      audioUri: params.audioUri,
      transcription: params.transcription,
      duration: params.duration,
    };

    runInAction(() => {
      this.notes.unshift(note);
    });
    await this.persistNote(note);
  }

  /**
   * Toggles the bookmarked state of a note with the specified ID.
   *
   * Finds the note in the `notes` array by its `noteId` and toggles its `bookmarked` property.
   * After updating the bookmarked state, it calls `persistNote` to persist the change to the database.
   *
   * @param noteId - The unique identifier of the note to toggle.
   */
  async toggleNoteBookmark(noteId: string) {
    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      runInAction(() => {
        note.bookmarked = !note.bookmarked;
      });
      await this.persistNote(note);
    }
  }

  /**
   * Updates the content of an existing note.
   *
   * Finds the note by its ID and updates its title, text, and/or category.
   * After updating the note properties, it calls `updateNote` to persist the changes.
   *
   * @param noteId - The unique identifier of the note to update.
   * @param params - The parameters containing the fields to update.
   * @param params.title - The new title for the note (optional).
   * @param params.text - The new text content for the note (optional).
   * @param params.category - The new category for the note (optional).
   */
  async updateNoteContent(
    noteId: string,
    params: {
      title?: string;
      text?: string;
      category?: NoteCategory;
      sketchDataUri?: string;
      photoUris?: string[];
    },
  ) {
    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      runInAction(() => {
        if (params.title !== undefined) {
          note.title = params.title;
        }
        if (params.text !== undefined) {
          note.text = params.text;
        }
        if (params.category !== undefined) {
          note.category = params.category;
        }
        if (params.sketchDataUri !== undefined) {
          note.sketchDataUri = params.sketchDataUri;
        }
        if (params.photoUris !== undefined) {
          note.photoUris = params.photoUris;
        }
      });
      await this.updateNote(note);
    }
  }

  /**
   * Sets the note category with the specified ID.
   *
   * Finds the note in the `notes` array by its `noteId` and sets its `category` property
   * to the provided `category` value. After updating the category, it calls `updateNote`
   * to persist or propagate the change.
   *
   * @param noteId - The unique identifier of the note to update.
   * @param category - The new category to assign to the note.
   */
  setNoteCategory(noteId: string, category: NoteCategory) {
    const idx = this.notes.findIndex((n) => n.id === noteId);
    if (idx >= 0) {
      runInAction(() => {
        this.notes[idx].category = category;
      });
      this.updateNote(this.notes[idx]).catch((error) => {
        console.error('Failed to update note category:', noteId, error);
      });
    }
  }

  /**
   * Attaches a photo URI to the note with the specified ID.
   *
   * Finds the note by its ID, adds the provided photo URI to its `photoUris` array,
   * and updates the note in the store.
   *
   * @param noteId - The unique identifier of the note to which the photo will be attached.
   * @param uri - The URI of the photo to attach to the note.
   */
  attachPhoto(noteId: string, uri: string) {
    const note = this.notes.find((item) => item.id === noteId);
    if (note) {
      runInAction(() => {
        note.photoUris.push(uri);
      });
      this.updateNote(note).catch((error) => {
        console.error('Failed to attach note photo:', noteId, error);
      });
    }
  }

  /**
   * Deletes a note by its ID from both the SQLite database and the in-memory notes list.
   *
   * The method first attempts to remove the note from the SQLite database to ensure data consistency.
   * If the database is not initialized, it removes the note from memory only.
   * After a successful database deletion, it updates the in-memory notes list.
   *
   * If an error occurs during deletion, it logs the error and attempts to reload the notes from the database
   * to recover from a potentially inconsistent state. If reloading also fails, it logs a critical error.
   *
   * @param noteId - The unique identifier of the note to be deleted.
   * @returns A Promise that resolves when the deletion process is complete.
   */
  async deleteNote(noteId: string) {
    // Remove from SQLite first to ensure consistency
    try {
      await this.initNotesDb();
      if (!this.notesDb) {
        // If no database, just remove from memory
        runInAction(() => {
          this.notes = this.notes.filter((n) => n.id !== noteId);
        });
        return;
      }
      await this.notesDb.executeSql('DELETE FROM notes WHERE id = ?', [noteId]);
      // Only remove from in-memory list after successful database deletion
      runInAction(() => {
        this.notes = this.notes.filter((n) => n.id !== noteId);
      });
    } catch (error) {
      console.error('Failed to delete note from database:', noteId, error);
      // Reload notes from database to recover from inconsistent state
      try {
        await this.loadNotes();
        console.log(
          'Successfully reloaded notes from database after delete failure',
        );
      } catch (reloadError) {
        console.error(
          'Failed to reload notes after delete failure - app state may be inconsistent:',
          reloadError,
        );
      }
    }
  }

  // --------------------------------------------------------------------
  // ===== Computed getters =====
  // --------------------------------------------------------------------

  /**
   * Returns the first 20 notes from the `notes` array.
   *
   * @remarks
   * This getter provides a quick way to access the most recent notes,
   * assuming the `notes` array is ordered with the most recent notes first.
   *
   * @returns An array containing up to 20 of the most recent `Note` objects.
   */
  get recentNotesTop20(): Note[] {
    return this.notes.slice(0, 20);
  }

  /**
   * Returns all bookmarked notes from the notes array.
   *
   * @remarks
   * This getter provides a quick way to access all notes that have been bookmarked.
   *
   * @returns An array of all bookmarked `Note` objects.
   */
  get bookmarkedNotes(): Note[] {
    return this.notes.filter((n) => n.bookmarked === true);
  }

  /**
   * Groups notes by their category and returns a mapping from each category to an array of notes belonging to that category.
   * Excludes Voice Logs which is managed separately.
   *
   * @returns An object where each key is a category name and the value is an array of notes in that category.
   */
  get notesByCategory(): Record<string, Note[]> {
    const map: Record<string, Note[]> = {};
    // Initialize all categories with empty arrays
    for (const category of this.categories) {
      map[category] = [];
    }
    // Populate with notes (excluding Voice Logs)
    for (const n of this.notes) {
      if (n.category === 'Voice Logs') {
        continue;
      }
      if (map[n.category]) {
        map[n.category].push(n);
      } else {
        const fallbackCategory = 'General';
        // Only assign to the fallback category if it already exists in the initialized categories map.
        if (Object.prototype.hasOwnProperty.call(map, fallbackCategory)) {
          map[fallbackCategory].push(n);
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn(
              `Note with orphaned category "${String(
                n.category,
              )}" assigned to fallback category "${fallbackCategory}".`,
            );
          }
        } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(
            `Note with orphaned category "${String(
              n.category,
            )}" could not be assigned to fallback category "${fallbackCategory}" because it is not in the current categories list.`,
          );
        }
      }
    }
    return map;
  }

  // --------------------------------------------------------------------
  // ===== SQLite persistence =====
  // --------------------------------------------------------------------

  /**
   * Initializes the notes database if it has not already been initialized.
   *
   * - Enables promise-based API for the SQLite plugin if available.
   * - Opens (or creates) a SQLite database named 'toast.db' at the default location.
   * - Runs the notes migration set to create/update the notes and categories tables.
   * - Handles errors by logging them and setting `notesDb` to null if initialization fails.
   *
   * @async
   * @returns {Promise<void>} Resolves when the database is initialized or already exists.
   */
  async initNotesDb(): Promise<void> {
    if (this.notesDb) return;
    if (!SQLite) return;
    try {
      SQLite.enablePromise?.(true);
      const db = await SQLite.openDatabase({
        name: 'toast.db',
        location: 'default',
      });
      this.notesDb = db;
      await runMigrations(db, 'notes', NOTE_MIGRATIONS);
    } catch (error) {
      console.error('Failed to initialize notes database:', error);
      this.notesDb = null;
    }
  }

  /**
   * Loads notes from the local database, parses their fields, and updates the store's notes array.
   *
   * This method initializes the notes database if it hasn't been already, executes a SQL query to
   * retrieve all notes ordered by their creation date (descending), and processes each row to construct
   * a `Note` object. It handles optional fields and parses the `photoUris` JSON string safely.
   * The resulting array of notes is then set to the store's `notes` property within a MobX action.
   *
   * @async
   * @returns {Promise<void>} Resolves when notes have been loaded and the store updated.
   */
  async loadNotes(): Promise<void> {
    await this.initNotesDb();
    if (!this.notesDb) return;
    const res = await this.notesDb.executeSql(
      'SELECT * FROM notes ORDER BY createdAt DESC',
    );
    const rows = res[0].rows;
    const loaded: Note[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows.item(i);
      loaded.push({
        id: r.id,
        createdAt: r.createdAt,
        latitude: r.latitude ?? undefined,
        longitude: r.longitude ?? undefined,
        category: r.category,
        type: r.type,
        title: r.title ?? undefined,
        text: r.text ?? undefined,
        bookmarked: r.bookmarked === 1 ? true : false,
        sketchDataUri: r.sketchDataUri ?? undefined,
        photoUris: (() => {
          if (!r.photoUris) return [];
          try {
            return JSON.parse(r.photoUris);
          } catch (e) {
            console.warn('Failed to parse photoUris for note:', r.id, e);
            return [];
          }
        })(),
        audioUri: r.audioUri ?? undefined,
        transcription: r.transcription ?? undefined,
        duration: r.duration ?? undefined,
      });
    }
    runInAction(() => {
      this.notes = loaded;
    });
  }

  /**
   * Persists a note object into the local notes database. If a note with the same ID already exists,
   * it will be replaced. Initializes the database if it hasn't been initialized yet.
   *
   * @param note - The note object to be persisted.
   * @throws Will throw an error if the database operation fails.
   */
  async persistNote(note: Note) {
    try {
      await this.initNotesDb();
      if (!this.notesDb) return;
      await this.notesDb.executeSql(
        'INSERT OR REPLACE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          note.id,
          note.createdAt,
          note.latitude ?? null,
          note.longitude ?? null,
          note.category,
          note.type,
          note.title ?? null,
          note.text ?? null,
          note.bookmarked ? 1 : 0,
          note.sketchDataUri ?? null,
          JSON.stringify(note.photoUris ?? []),
          note.audioUri ?? null,
          note.transcription ?? null,
          note.duration ?? null,
        ],
      );
    } catch (error) {
      console.error('Failed to persist note:', error);
      throw error;
    }
  }

  /**
   * Updates the given note by persisting its changes.
   *
   * @param note - The note object to be updated and persisted.
   * @returns A promise that resolves when the note has been successfully updated.
   * @throws Will throw an error if persisting the note fails.
   */
  async updateNote(note: Note) {
    try {
      await this.persistNote(note);
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------
  // ===== Category Management =====
  // --------------------------------------------------------------------

  /**
   * Loads categories from the database.
   * If no categories exist, creates default categories.
   */
  async loadCategories(): Promise<void> {
    await this.initNotesDb();
    if (!this.notesDb) {
      // If no database, use default categories
      runInAction(() => {
        this.categories = ['General', 'Work', 'Personal', 'Ideas'];
      });
      return;
    }
    try {
      const res = await this.notesDb.executeSql(
        'SELECT * FROM categories ORDER BY createdAt ASC',
      );
      const rows = res[0].rows;
      const loadedCategories: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows.item(i);
        loadedCategories.push(r.name);
      }
      runInAction(() => {
        this.categories = loadedCategories;
      });
      // If no categories exist, create defaults
      if (loadedCategories.length === 0) {
        await this.createDefaultCategories();
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Fallback to default categories
      runInAction(() => {
        this.categories = ['General', 'Work', 'Personal', 'Ideas'];
      });
    }
  }

  /**
   * Creates default categories.
   */
  async createDefaultCategories(): Promise<void> {
    const defaultCategories = ['General', 'Work', 'Personal', 'Ideas'];
    for (const category of defaultCategories) {
      try {
        await this.addCategory(category);
      } catch (error) {
        // If the category already exists, skip and continue with the remaining defaults.
        if (
          error instanceof Error &&
          error.message === 'Category already exists'
        ) {
          continue;
        }
        // Re-throw unexpected errors to preserve existing failure behavior.
        throw error;
      }
    }
  }

  /**
   * Adds a new category.
   * @param name - The name of the category to add.
   * @throws Will throw an error if the category already exists or if the database operation fails.
   */
  async addCategory(name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Category name cannot be empty');
    }
    if (trimmedName === 'Voice Logs') {
      throw new Error('Voice Logs is a reserved category name');
    }
    if (
      this.categories.some(
        (category) => category.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      throw new Error('Category already exists');
    }
    await this.initNotesDb();
    if (!this.notesDb) {
      // If no database, just add to memory
      runInAction(() => {
        this.categories.push(trimmedName);
      });
      return;
    }
    try {
      await this.notesDb.executeSql(
        'INSERT INTO categories (name, createdAt) VALUES (?, ?)',
        [trimmedName, Date.now()],
      );
      runInAction(() => {
        this.categories.push(trimmedName);
      });
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  }

  /**
   * Deletes a category.
   * If the category has notes, they will be reassigned to the specified fallback category.
   *
   * Note: The note count shown in UI warnings is advisory. Due to the async nature of the operation,
   * the actual number of notes moved may differ if notes are added/modified between the count check
   * and the deletion. The database transaction ensures atomicity of the deletion itself.
   *
   * @param name - The name of the category to delete.
   * @param fallbackCategory - The category to reassign notes to. If not specified, uses the first available category.
   * @throws Will throw an error if trying to delete the last category or if the database operation fails.
   */
  async deleteCategory(name: string, fallbackCategory?: string): Promise<void> {
    if (this.categories.length <= 1) {
      throw new Error('Cannot delete the last category');
    }
    if (!this.categories.includes(name)) {
      throw new Error('Category does not exist');
    }

    // Determine fallback category if not provided
    const actualFallback =
      fallbackCategory || this.categories.find((c) => c !== name);
    if (!actualFallback) {
      throw new Error('No fallback category available');
    }
    if (actualFallback === name) {
      throw new Error(
        'Fallback category cannot be the same as the category being deleted',
      );
    }
    if (!this.categories.includes(actualFallback)) {
      throw new Error('Fallback category does not exist');
    }

    await this.initNotesDb();

    // Reassign notes from the deleted category to the fallback category
    const notesToReassign = this.notes.filter((n) => n.category === name);

    if (!this.notesDb) {
      // No database: update notes and categories only in memory, as before
      for (const note of notesToReassign) {
        runInAction(() => {
          note.category = actualFallback;
        });
        await this.updateNote(note);
      }
      runInAction(() => {
        this.categories = this.categories.filter((c) => c !== name);
      });
      return;
    }

    try {
      // Use a transaction to ensure atomicity of the delete operation
      await this.notesDb.executeSql('BEGIN TRANSACTION');

      try {
        // Database present: batch update all affected notes in a single query
        await this.notesDb.executeSql(
          'UPDATE notes SET category = ? WHERE category = ?',
          [actualFallback, name],
        );

        // Delete the category
        await this.notesDb.executeSql('DELETE FROM categories WHERE name = ?', [
          name,
        ]);

        await this.notesDb.executeSql('COMMIT');

        // Update in-memory state after successful transaction
        runInAction(() => {
          for (const note of notesToReassign) {
            note.category = actualFallback;
          }
          this.categories = this.categories.filter((c) => c !== name);
        });
      } catch (transactionError) {
        // Rollback on any error
        await this.notesDb.executeSql('ROLLBACK');
        throw transactionError;
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  /**
   * Gets the count of notes in a specific category.
   * @param categoryName - The name of the category.
   * @returns The number of notes in the category.
   */
  getCategoryNoteCount(categoryName: string): number {
    return this.notes.filter((n) => n.category === categoryName).length;
  }

  // --------------------------------------------------------------------
  // ==== Backup / Restore ====
  // --------------------------------------------------------------------

  /**
   * Imports notes and note categories from a backup.
   * In 'replace' mode all existing notes and categories are removed first.
   * In 'merge' mode new notes and categories are added without removing existing ones.
   *
   * @param noteCategories - Category names to import.
   * @param notes - Notes to import.
   * @param mode - 'replace' clears all existing data first; 'merge' adds without deleting.
   */
  async importNotesData(
    noteCategories: string[],
    notes: Note[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    await this.initNotesDb();
    if (this.notesDb) {
      const noteSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
          : 'INSERT OR IGNORE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      try {
        await this.notesDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.notesDb.executeSql('DELETE FROM notes');
          await this.notesDb.executeSql('DELETE FROM categories');
        }
        for (const cat of noteCategories) {
          await this.notesDb.executeSql(
            'INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)',
            [cat, Date.now()],
          );
        }
        for (const note of notes) {
          await this.notesDb.executeSql(noteSql, [
            note.id,
            note.createdAt,
            note.latitude ?? null,
            note.longitude ?? null,
            note.category,
            note.type,
            note.title ?? null,
            note.text ?? null,
            note.bookmarked ? 1 : 0,
            note.sketchDataUri ?? null,
            JSON.stringify(note.photoUris ?? []),
            note.audioUri ?? null,
            note.transcription ?? null,
            note.duration ?? null,
          ]);
        }
        await this.notesDb.executeSql('COMMIT');
      } catch (error) {
        await this.notesDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.categories = noteCategories;
        this.notes = notes;
      } else {
        const newCats = noteCategories.filter(
          (c) => !this.categories.includes(c),
        );
        const existingIds = new Set(this.notes.map((n) => n.id));
        const newNotes = notes.filter((n) => !existingIds.has(n.id));
        this.categories = [...this.categories, ...newCats];
        this.notes = [...this.notes, ...newNotes];
      }
    });
  }

  // --------------------------------------------------------------------
  // ==== Cleanup on store disposal ====
  // --------------------------------------------------------------------
  dispose() {
    this.notesDb = null;
  }
}
