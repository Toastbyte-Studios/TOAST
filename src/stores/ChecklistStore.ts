import { makeAutoObservable, runInAction } from 'mobx';
import { SQLiteDatabase } from '../types/database-types';
import { Migration, runMigrations } from '../utils/dbMigrations';

const CHECKLIST_MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Create checklists table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS checklists (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'name TEXT NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'isDefault INTEGER DEFAULT 0' +
          ')',
      );
    },
  },
  {
    id: 2,
    description: 'Create checklist_items table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS checklist_items (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'checklistId TEXT NOT NULL,' +
          'text TEXT NOT NULL,' +
          'checked INTEGER DEFAULT 0,' +
          '"order" INTEGER NOT NULL,' +
          'FOREIGN KEY(checklistId) REFERENCES checklists(id) ON DELETE CASCADE' +
          ')',
      );
    },
  },
];

const DEFAULT_CHECKLISTS = [
  {
    name: 'Bug-out bag',
    items: [
      'Can opener',
      'Cell phone with chargers',
      'Dust mask or cloth',
      'Emergency radio',
      'First aid kit',
      'Flashlight and extra batteries',
      'Local maps',
      'Matches in waterproof container',
      'Moist towelettes and garbage bags',
      'Multi-tool or knife',
      'Non-perishable food (3-day supply)',
      'Plastic sheeting and duct tape',
      'Water (1 gallon per person per day)',
      'Whistle to signal for help',
      'Wrench or pliers',
    ],
  },
  {
    name: 'First-aid kit',
    items: [
      'Adhesive bandages (various sizes)',
      'Adhesive tape',
      'Antibiotic ointment',
      'Antiseptic wipes',
      'Cotton balls and swabs',
      'CPR face shield',
      'Disposable gloves',
      'Elastic bandage',
      'Emergency blanket',
      'Gauze pads and rolls',
      'Pain relievers (aspirin, ibuprofen)',
      'Prescription medications',
      'Scissors',
      'Thermometer',
      'Tweezers',
    ],
  },
  {
    name: 'Evacuation kit',
    items: [
      'Baby supplies (if needed)',
      'Books or games',
      'Cash and credit cards',
      'Change of clothes',
      'Copies of insurance policies',
      'Emergency contact list',
      'Eyeglasses/contacts',
      'Important documents (copies)',
      'Medications (7-day supply)',
      'Personal hygiene items',
      'Pet supplies (if needed)',
      'Phone charger and battery pack',
      'Sleeping bag or blanket',
      'Spare keys',
      'Sturdy shoes',
    ],
  },
];

export interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  checked: boolean;
  order: number; // Maintained for database compatibility; display order determined by alphabetical sorting
}

export interface Checklist {
  id: string;
  name: string;
  createdAt: number;
  isDefault: boolean;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ChecklistStore {
  checklists: Checklist[] = [];
  checklistItems: ChecklistItem[] = [];
  checklistDb: SQLiteDatabase | null = null;
  private databaseInitialized: boolean = false;
  private databaseInitPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async initDatabase(db: SQLiteDatabase | null): Promise<void> {
    if (this.checklistDb !== db) {
      this.databaseInitialized = false;
      this.databaseInitPromise = null;
    }
    this.checklistDb = db;
    if (!this.checklistDb) return;
    if (this.databaseInitialized) return;
    if (this.databaseInitPromise) {
      await this.databaseInitPromise;
      return;
    }

    const database = this.checklistDb;
    this.databaseInitPromise = (async () => {
      try {
        await runMigrations(database, 'checklists', CHECKLIST_MIGRATIONS);
        this.databaseInitialized = true;
      } catch (error) {
        console.error('Failed to initialize checklists database:', error);
      } finally {
        this.databaseInitPromise = null;
      }
    })();

    try {
      await this.databaseInitPromise;
    } finally {
      if (!this.databaseInitialized) {
        this.databaseInitPromise = null;
      }
    }
  }

  /**
   * Loads checklists and checklist items from the database.
   * If no checklists exist, creates default checklists with default items.
   */
  async loadChecklists(): Promise<void> {
    if (!this.checklistDb) return;

    try {
      const checklistsRes = await this.checklistDb.executeSql(
        'SELECT * FROM checklists ORDER BY createdAt ASC',
      );
      const checklistRows = checklistsRes[0].rows;
      const loadedChecklists: Checklist[] = [];
      for (let i = 0; i < checklistRows.length; i++) {
        const row = checklistRows.item(i);
        loadedChecklists.push({
          id: row.id,
          name: row.name,
          createdAt: row.createdAt,
          isDefault: row.isDefault === 1,
        });
      }

      const itemsRes = await this.checklistDb.executeSql(
        'SELECT * FROM checklist_items ORDER BY checklistId, "order" ASC',
      );
      const itemRows = itemsRes[0].rows;
      const loadedItems: ChecklistItem[] = [];
      for (let i = 0; i < itemRows.length; i++) {
        const row = itemRows.item(i);
        loadedItems.push({
          id: row.id,
          checklistId: row.checklistId,
          text: row.text,
          checked: row.checked === 1,
          order: row.order,
        });
      }

      runInAction(() => {
        this.checklists = loadedChecklists;
        this.checklistItems = loadedItems;
      });

      if (loadedChecklists.length === 0) {
        await this.createDefaultChecklists();
      }
    } catch (error) {
      console.error('Failed to load checklists:', error);
    }
  }

  /**
   * Creates default checklists with default items.
   */
  async createDefaultChecklists(): Promise<void> {
    for (const checklist of DEFAULT_CHECKLISTS) {
      await this.createChecklist(checklist.name, true, checklist.items);
    }
  }

  /**
   * Creates a new checklist with optional default items.
   */
  async createChecklist(
    name: string,
    isDefault: boolean = false,
    defaultItems: string[] = [],
  ): Promise<void> {
    const checklist: Checklist = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      isDefault,
    };

    runInAction(() => {
      this.checklists.push(checklist);
    });

    await this.persistChecklist(checklist);

    for (const itemText of defaultItems) {
      await this.addChecklistItem(checklist.id, itemText);
    }
  }

  /**
   * Deletes a checklist and all its items.
   */
  async deleteChecklist(checklistId: string): Promise<void> {
    try {
      if (!this.checklistDb) {
        runInAction(() => {
          this.checklists = this.checklists.filter((c) => c.id !== checklistId);
          this.checklistItems = this.checklistItems.filter(
            (item) => item.checklistId !== checklistId,
          );
        });
        return;
      }

      await this.checklistDb.executeSql(
        'DELETE FROM checklist_items WHERE checklistId = ?',
        [checklistId],
      );
      await this.checklistDb.executeSql('DELETE FROM checklists WHERE id = ?', [
        checklistId,
      ]);

      runInAction(() => {
        this.checklists = this.checklists.filter((c) => c.id !== checklistId);
        this.checklistItems = this.checklistItems.filter(
          (item) => item.checklistId !== checklistId,
        );
      });
    } catch (error) {
      console.error('Failed to delete checklist:', error);
      throw error;
    }
  }

  /**
   * Adds a new item to a checklist.
   * New items are added to the top of the list (order = 0).
   */
  async addChecklistItem(checklistId: string, text: string): Promise<void> {
    const existingItems = this.checklistItems.filter(
      (item) => item.checklistId === checklistId,
    );
    const maxOrder =
      existingItems.length > 0
        ? Math.max(...existingItems.map((item) => item.order))
        : -1;

    const item: ChecklistItem = {
      id: generateId(),
      checklistId,
      text,
      checked: false,
      order: maxOrder + 1,
    };

    runInAction(() => {
      this.checklistItems.push(item);
    });

    await this.persistChecklistItem(item);
  }

  /**
   * Toggles the checked state of a checklist item.
   */
  async toggleChecklistItem(itemId: string): Promise<void> {
    const item = this.checklistItems.find((existing) => existing.id === itemId);
    if (item) {
      runInAction(() => {
        item.checked = !item.checked;
      });
      await this.persistChecklistItem(item);
    }
  }

  /**
   * Deletes a checklist item.
   */
  async deleteChecklistItem(itemId: string): Promise<void> {
    try {
      if (!this.checklistDb) {
        runInAction(() => {
          this.checklistItems = this.checklistItems.filter(
            (item) => item.id !== itemId,
          );
        });
        return;
      }

      await this.checklistDb.executeSql(
        'DELETE FROM checklist_items WHERE id = ?',
        [itemId],
      );

      runInAction(() => {
        this.checklistItems = this.checklistItems.filter(
          (item) => item.id !== itemId,
        );
      });
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
      throw error;
    }
  }

  /**
   * Persists a checklist to the database.
   */
  async persistChecklist(checklist: Checklist): Promise<void> {
    try {
      if (!this.checklistDb) return;
      await this.checklistDb.executeSql(
        'INSERT OR REPLACE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)',
        [
          checklist.id,
          checklist.name,
          checklist.createdAt,
          checklist.isDefault ? 1 : 0,
        ],
      );
    } catch (error) {
      console.error('Failed to persist checklist:', error);
      throw error;
    }
  }

  /**
   * Persists a checklist item to the database.
   */
  async persistChecklistItem(item: ChecklistItem): Promise<void> {
    try {
      if (!this.checklistDb) return;
      await this.checklistDb.executeSql(
        'INSERT OR REPLACE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)',
        [
          item.id,
          item.checklistId,
          item.text,
          item.checked ? 1 : 0,
          item.order,
        ],
      );
    } catch (error) {
      console.error('Failed to persist checklist item:', error);
      throw error;
    }
  }

  /**
   * Gets all items for a specific checklist.
   */
  getChecklistItems(checklistId: string): ChecklistItem[] {
    return this.checklistItems
      .filter((item) => item.checklistId === checklistId)
      .sort((a, b) =>
        a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
      );
  }

  /**
   * Imports checklists and checklist items from a backup.
   * In 'replace' mode all existing checklists and items are removed first.
   * In 'merge' mode new checklists are added without removing existing ones.
   */
  async importChecklistsData(
    checklists: Checklist[],
    checklistItems: ChecklistItem[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    if (this.checklistDb) {
      const checklistSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)'
          : 'INSERT OR IGNORE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)';
      const itemSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)'
          : 'INSERT OR IGNORE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)';
      try {
        await this.checklistDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.checklistDb.executeSql('DELETE FROM checklist_items');
          await this.checklistDb.executeSql('DELETE FROM checklists');
        }
        for (const checklist of checklists) {
          await this.checklistDb.executeSql(checklistSql, [
            checklist.id,
            checklist.name,
            checklist.createdAt,
            checklist.isDefault ? 1 : 0,
          ]);
        }
        for (const item of checklistItems) {
          await this.checklistDb.executeSql(itemSql, [
            item.id,
            item.checklistId,
            item.text,
            item.checked ? 1 : 0,
            item.order,
          ]);
        }
        await this.checklistDb.executeSql('COMMIT');
      } catch (error) {
        await this.checklistDb.executeSql('ROLLBACK');
        throw error;
      }
    }

    runInAction(() => {
      if (mode === 'replace') {
        this.checklists = checklists;
        this.checklistItems = checklistItems;
      } else {
        const existingChecklistIds = new Set(this.checklists.map((c) => c.id));
        const newChecklists = checklists.filter(
          (c) => !existingChecklistIds.has(c.id),
        );
        const existingItemIds = new Set(this.checklistItems.map((i) => i.id));
        const newItems = checklistItems.filter(
          (i) => !existingItemIds.has(i.id),
        );
        this.checklists = [...this.checklists, ...newChecklists];
        this.checklistItems = [...this.checklistItems, ...newItems];
      }
    });
  }

  dispose() {
    this.checklistDb = null;
    this.databaseInitialized = false;
    this.databaseInitPromise = null;
  }
}
