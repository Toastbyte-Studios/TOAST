import { makeAutoObservable, runInAction, computed } from 'mobx';
import { SQLiteDatabase } from '../types/database-types';
import {
  Migration,
  getTableColumns,
  runMigrations,
} from '../utils/dbMigrations';

/** Expiration status based on days remaining until end of the expiration month. */
export type ExpirationStatus = 'green' | 'yellow' | 'red' | 'none';

/** An item paired with its pre-computed alert tier for footer notifications. */
export interface ExpirationAlert {
  item: PantryItem;
  alertType: '30day' | 'expired';
}

let SQLite: any;
try {
  SQLite = require('react-native-sqlite-storage');
} catch {
  SQLite = null as any;
}

// ─── Pantry migrations ────────────────────────────────────────────────────────

const PANTRY_MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Create pantry_categories table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS pantry_categories (' +
          'name TEXT PRIMARY KEY,' +
          'createdAt INTEGER NOT NULL' +
          ')',
      );
    },
  },
  {
    id: 2,
    description: 'Create pantry_items table with full current schema',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS pantry_items (' +
          'id TEXT PRIMARY KEY,' +
          'name TEXT NOT NULL,' +
          'category TEXT NOT NULL,' +
          'quantity REAL NOT NULL,' +
          'unit TEXT,' +
          'notes TEXT,' +
          'expirationMonth INTEGER,' +
          'expirationYear INTEGER,' +
          'createdAt INTEGER NOT NULL,' +
          'updatedAt INTEGER NOT NULL' +
          ')',
      );
    },
  },
  {
    id: 3,
    description:
      'Add missing expiration columns for legacy pantry_items tables',
    run: async (db) => {
      const columns = await getTableColumns(db, 'pantry_items');
      if (!columns.has('expirationMonth')) {
        await db.executeSql(
          'ALTER TABLE pantry_items ADD COLUMN expirationMonth INTEGER',
        );
      }
      if (!columns.has('expirationYear')) {
        await db.executeSql(
          'ALTER TABLE pantry_items ADD COLUMN expirationYear INTEGER',
        );
      }
    },
  },
];

/**
 * Represents a single pantry item (food item).
 */
export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit?: string; // e.g., "pieces", "lbs", "gallons"
  notes?: string;
  expirationMonth?: number; // 1-12
  expirationYear?: number; // e.g., 2024, 2025
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

/**
 * Store for managing pantry items and categories.
 * Follows the same pattern as InventoryStore but for food items.
 */
export class PantryStore {
  pantryDb: SQLiteDatabase | null = null;
  items: PantryItem[] = [];
  categories: string[] = [];

  constructor() {
    makeAutoObservable(
      this,
      {
        itemsByCategory: computed,
        itemsSortedByExpiration: false,
      },
      { autoBind: true },
    );
  }

  /**
   * Generates a unique ID using timestamp and random string.
   * This avoids the need for crypto.getRandomValues() which isn't available in React Native.
   * @private
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Computed property that groups items by category.
   */
  get itemsByCategory(): Record<string, PantryItem[]> {
    const grouped: Record<string, PantryItem[]> = {};

    // Initialize all categories with empty arrays
    for (const category of this.categories) {
      grouped[category] = [];
    }

    // Group items by category
    for (const item of this.items) {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    }

    return grouped;
  }

  /**
   * Gets all items sorted alphabetically by name.
   */
  get allItemsSorted(): PantryItem[] {
    return [...this.items].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  /**
   * Returns the number of days remaining until the end of the item's expiration
   * month (last day at 23:59:59). Returns null if no expiration date is set.
   *
   * @param item - The pantry item to check.
   */
  getExpirationDaysRemaining(item: PantryItem): number | null {
    if (!item.expirationMonth || !item.expirationYear) {
      return null;
    }
    // Day 0 of the following month = last day of the expiration month.
    const expirationDate = new Date(
      item.expirationYear,
      item.expirationMonth,
      0,
    );
    expirationDate.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffDays =
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    // Use floor for non-negative diffs so the final day of the expiration month
    // reports 0 days remaining; use ceil for negative diffs (already expired).
    return diffDays >= 0 ? Math.floor(diffDays) : Math.ceil(diffDays);
  }

  /**
   * Returns a color-coded expiration status for a pantry item.
   *
   * Since expiration dates only have month and year resolution (no specific day),
   * the status thresholds align with whole-month granularity:
   * - `'red'`    — the expiration month has already passed (item is expired)
   * - `'yellow'` — expiring within the next 30 days (this month or early next month)
   * - `'green'`  — more than 30 days remaining
   * - `'none'`   — no expiration date set
   *
   * @param item - The pantry item to evaluate.
   */
  getExpirationStatus(item: PantryItem): ExpirationStatus {
    const days = this.getExpirationDaysRemaining(item);
    if (days === null) {
      return 'none';
    }
    if (days <= 0) {
      return 'red';
    }
    if (days <= 30) {
      return 'yellow';
    }
    return 'green';
  }

  /**
   * All items that have an expiration date, sorted soonest-first.
   * Items without an expiration date are excluded.
   *
   * Implemented as a plain method rather than a MobX computed because it
   * depends on `new Date()` which is not observable; a computed would
   * become stale while the app stays open without any item changes.
   *
   * @remarks
   * Each call performs date calculations and array operations; avoid calling
   * this in tight loops or performance-critical hot paths.
   */
  itemsSortedByExpiration(): PantryItem[] {
    return [...this.items]
      .filter((item) => item.expirationMonth && item.expirationYear)
      .sort((a, b) => {
        const daysA = this.getExpirationDaysRemaining(a) ?? Infinity;
        const daysB = this.getExpirationDaysRemaining(b) ?? Infinity;
        return daysA - daysB;
      });
  }

  /**
   * Returns items that trigger a notification alert.
   *
   * Since expiration dates only store month and year, the tiers are:
   * - `'expired'` — the expiration month has passed (days remaining ≤ 0)
   * - `'30day'`   — expiring within the next 30 days (but not yet expired)
   *
   * Items without an expiration date are ignored.
   */
  getExpirationAlerts(): ExpirationAlert[] {
    const alerts: ExpirationAlert[] = [];
    for (const item of this.items) {
      const days = this.getExpirationDaysRemaining(item);
      if (days === null) {
        continue;
      }
      if (days <= 0) {
        alerts.push({ item, alertType: 'expired' });
      } else if (days > 0 && days <= 30) {
        alerts.push({ item, alertType: '30day' });
      }
    }
    return alerts;
  }

  /**
   * Gets the count of items in a specific category.
   */
  getCategoryItemCount(categoryName: string): number {
    return this.items.filter((item) => item.category === categoryName).length;
  }

  /**
   * Initializes the database connection and loads data.
   */
  async initDatabase(): Promise<void> {
    if (!SQLite) {
      console.warn('SQLite not available, using in-memory storage');
      await this.loadDefaultCategories();
      return;
    }

    try {
      const db = await SQLite.openDatabase({
        name: 'toast.db',
        location: 'default',
      });
      this.pantryDb = db;
      await runMigrations(db, 'pantry', PANTRY_MIGRATIONS);
      await this.loadCategories();
      await this.loadItems();
    } catch (error) {
      console.error('Failed to initialize pantry database:', error);
    }
  }

  /**
   * Loads categories from the database.
   */
  private async loadCategories(): Promise<void> {
    if (!this.pantryDb) {
      await this.loadDefaultCategories();
      return;
    }

    try {
      const [results] = await this.pantryDb.executeSql(
        'SELECT * FROM pantry_categories ORDER BY createdAt ASC',
      );

      if (results && results.rows && results.rows.length > 0) {
        const loadedCategories: string[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          loadedCategories.push(row.name);
        }
        runInAction(() => {
          this.categories = loadedCategories;
        });
      }

      // If no categories exist, create defaults
      if (this.categories.length === 0) {
        await this.createDefaultCategories();
      }
    } catch (error) {
      console.error('Failed to load pantry categories:', error);
      await this.loadDefaultCategories();
    }
  }

  /**
   * Loads default categories into memory without database.
   */
  private async loadDefaultCategories(): Promise<void> {
    runInAction(() => {
      this.categories = ['Canned Goods', 'Dry Goods', 'Frozen', 'Fresh'];
    });
  }

  /**
   * Creates default categories in the database.
   */
  private async createDefaultCategories(): Promise<void> {
    const defaultCategories = ['Canned Goods', 'Dry Goods', 'Frozen', 'Fresh'];
    for (const category of defaultCategories) {
      await this.addCategory(category);
    }
    // Add default items
    await this.createDefaultItems();
  }

  /**
   * Creates default pantry items for the default categories.
   */
  private async createDefaultItems(): Promise<void> {
    // Default items for Canned Goods
    const cannedGoodsItems = [
      { name: 'Canned Beans', quantity: 10, unit: 'cans' },
      { name: 'Canned Soup', quantity: 8, unit: 'cans' },
      { name: 'Canned Vegetables', quantity: 12, unit: 'cans' },
      { name: 'Canned Fruit', quantity: 6, unit: 'cans' },
    ];

    // Default items for Dry Goods
    const dryGoodsItems = [
      { name: 'Rice', quantity: 5, unit: 'lbs' },
      { name: 'Pasta', quantity: 10, unit: 'boxes' },
      { name: 'Flour', quantity: 3, unit: 'lbs' },
      { name: 'Sugar', quantity: 2, unit: 'lbs' },
    ];

    // Default items for Frozen
    const frozenItems = [
      { name: 'Frozen Vegetables', quantity: 5, unit: 'bags' },
      { name: 'Frozen Meat', quantity: 3, unit: 'lbs' },
    ];

    // Default items for Fresh
    const freshItems = [
      { name: 'Potatoes', quantity: 5, unit: 'lbs' },
      { name: 'Onions', quantity: 3, unit: 'lbs' },
    ];

    try {
      for (const item of cannedGoodsItems) {
        await this.createItem(
          item.name,
          'Canned Goods',
          item.quantity,
          item.unit,
          undefined,
        );
      }

      for (const item of dryGoodsItems) {
        await this.createItem(
          item.name,
          'Dry Goods',
          item.quantity,
          item.unit,
          undefined,
        );
      }

      for (const item of frozenItems) {
        await this.createItem(
          item.name,
          'Frozen',
          item.quantity,
          item.unit,
          undefined,
        );
      }

      for (const item of freshItems) {
        await this.createItem(
          item.name,
          'Fresh',
          item.quantity,
          item.unit,
          undefined,
        );
      }
    } catch (error) {
      console.error('Failed to create default items:', error);
    }
  }

  /**
   * Loads all pantry items from the database.
   */
  private async loadItems(): Promise<void> {
    if (!this.pantryDb) return;

    try {
      const [results] = await this.pantryDb.executeSql(
        'SELECT * FROM pantry_items ORDER BY name ASC',
      );

      if (results && results.rows && results.rows.length > 0) {
        const loadedItems: PantryItem[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          loadedItems.push({
            id: row.id,
            name: row.name,
            category: row.category,
            quantity: row.quantity,
            unit: row.unit || undefined,
            notes: row.notes || undefined,
            expirationMonth: row.expirationMonth || undefined,
            expirationYear: row.expirationYear || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        runInAction(() => {
          this.items = loadedItems;
        });
      } else {
        // If no items exist and we have the default categories, create default items
        const defaultCategories = [
          'Canned Goods',
          'Dry Goods',
          'Frozen',
          'Fresh',
        ];
        const hasDefaultCategories = defaultCategories.every((category) =>
          this.categories.includes(category),
        );
        if (hasDefaultCategories) {
          await this.createDefaultItems();
        }
      }
    } catch (error) {
      console.error('Failed to load pantry items:', error);
    }
  }

  /**
   * Adds a new category.
   */
  async addCategory(name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Category name cannot be empty');
    }
    if (this.categories.includes(trimmedName)) {
      throw new Error('Category already exists');
    }

    const createdAt = Date.now();

    if (!this.pantryDb) {
      runInAction(() => {
        this.categories.push(trimmedName);
      });
      return;
    }

    try {
      await this.pantryDb.executeSql(
        'INSERT INTO pantry_categories (name, createdAt) VALUES (?, ?)',
        [trimmedName, createdAt],
      );
      runInAction(() => {
        this.categories.push(trimmedName);
      });
    } catch (error) {
      console.error('Failed to add pantry category:', error);
      throw new Error('Failed to add category');
    }
  }

  /**
   * Deletes a category and optionally moves items to a fallback category.
   */
  async deleteCategory(name: string, fallbackCategory?: string): Promise<void> {
    if (this.categories.length <= 1) {
      throw new Error('Cannot delete the last category');
    }

    if (!this.categories.includes(name)) {
      throw new Error('Category does not exist');
    }

    const itemsInCategory = this.items.filter((item) => item.category === name);

    // If there are items, we need a fallback category
    if (itemsInCategory.length > 0) {
      if (!fallbackCategory) {
        throw new Error('Fallback category required when category has items');
      }
      if (!this.categories.includes(fallbackCategory)) {
        throw new Error('Fallback category does not exist');
      }

      // Move items to fallback category
      for (const item of itemsInCategory) {
        await this.updateItem(item.id, { category: fallbackCategory });
      }
    }

    // Delete the category
    if (this.pantryDb) {
      try {
        await this.pantryDb.executeSql(
          'DELETE FROM pantry_categories WHERE name = ?',
          [name],
        );
      } catch (error) {
        console.error('Failed to delete pantry category:', error);
        throw new Error('Failed to delete category');
      }
    }

    runInAction(() => {
      this.categories = this.categories.filter((c) => c !== name);
    });
  }

  /**
   * Creates a new pantry item.
   */
  async createItem(
    name: string,
    category: string,
    quantity: number,
    unit?: string,
    notes?: string,
    expirationMonth?: number,
    expirationYear?: number,
  ): Promise<PantryItem> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Item name cannot be empty');
    }
    if (!this.categories.includes(category)) {
      throw new Error('Invalid category');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    if (
      expirationMonth !== undefined &&
      (expirationMonth < 1 || expirationMonth > 12)
    ) {
      throw new Error('Expiration month must be between 1 and 12');
    }
    if (expirationYear !== undefined) {
      const currentYear = new Date().getFullYear();
      if (expirationYear < currentYear || expirationYear > currentYear + 50) {
        throw new Error(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      }
    }

    const now = Date.now();
    const item: PantryItem = {
      id: this.generateId(),
      name: trimmedName,
      category,
      quantity,
      unit: unit?.trim() || undefined,
      notes: notes?.trim() || undefined,
      expirationMonth,
      expirationYear,
      createdAt: now,
      updatedAt: now,
    };

    if (this.pantryDb) {
      try {
        await this.pantryDb.executeSql(
          'INSERT INTO pantry_items (id, name, category, quantity, unit, notes, expirationMonth, expirationYear, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            item.id,
            item.name,
            item.category,
            item.quantity,
            item.unit || null,
            item.notes || null,
            item.expirationMonth || null,
            item.expirationYear || null,
            item.createdAt,
            item.updatedAt,
          ],
        );
      } catch (error) {
        console.error('Failed to create pantry item:', error);
        throw new Error('Failed to create item');
      }
    }

    runInAction(() => {
      this.items.push(item);
    });

    return item;
  }

  /**
   * Updates an existing pantry item.
   */
  async updateItem(
    id: string,
    updates: Partial<Omit<PantryItem, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error('Item not found');
    }

    if (updates.category && !this.categories.includes(updates.category)) {
      throw new Error('Invalid category');
    }
    if (updates.quantity !== undefined && updates.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    if (
      updates.expirationMonth !== undefined &&
      (updates.expirationMonth < 1 || updates.expirationMonth > 12)
    ) {
      throw new Error('Expiration month must be between 1 and 12');
    }
    if (updates.expirationYear !== undefined) {
      const currentYear = new Date().getFullYear();
      if (
        updates.expirationYear < currentYear ||
        updates.expirationYear > currentYear + 50
      ) {
        throw new Error(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      }
    }

    const updatedItem: PantryItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
    };

    if (this.pantryDb) {
      try {
        await this.pantryDb.executeSql(
          'UPDATE pantry_items SET name = ?, category = ?, quantity = ?, unit = ?, notes = ?, expirationMonth = ?, expirationYear = ?, updatedAt = ? WHERE id = ?',
          [
            updatedItem.name,
            updatedItem.category,
            updatedItem.quantity,
            updatedItem.unit || null,
            updatedItem.notes || null,
            updatedItem.expirationMonth || null,
            updatedItem.expirationYear || null,
            updatedItem.updatedAt,
            id,
          ],
        );
      } catch (error) {
        console.error('Failed to update pantry item:', error);
        throw new Error('Failed to update item');
      }
    }

    runInAction(() => {
      const index = this.items.findIndex((i) => i.id === id);
      if (index !== -1) {
        this.items[index] = updatedItem;
      }
    });
  }

  /**
   * Deletes a pantry item.
   */
  async deleteItem(id: string): Promise<void> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error('Item not found');
    }

    if (this.pantryDb) {
      try {
        await this.pantryDb.executeSql(
          'DELETE FROM pantry_items WHERE id = ?',
          [id],
        );
      } catch (error) {
        console.error('Failed to delete pantry item:', error);
        throw new Error('Failed to delete item');
      }
    }

    runInAction(() => {
      this.items = this.items.filter((i) => i.id !== id);
    });
  }

  /**
   * Imports pantry data from a backup, either replacing all existing data
   * ('replace' mode) or merging new items with existing data ('merge' mode).
   *
   * @param categories - Category names to import.
   * @param items - Pantry items to import.
   * @param mode - 'replace' clears all existing data first; 'merge' adds without deleting.
   */
  async importData(
    categories: string[],
    items: PantryItem[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    if (this.pantryDb) {
      const itemSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO pantry_items (id, name, category, quantity, unit, notes, expirationMonth, expirationYear, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)'
          : 'INSERT OR IGNORE INTO pantry_items (id, name, category, quantity, unit, notes, expirationMonth, expirationYear, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)';
      try {
        await this.pantryDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.pantryDb.executeSql('DELETE FROM pantry_items');
          await this.pantryDb.executeSql('DELETE FROM pantry_categories');
        }
        for (const cat of categories) {
          await this.pantryDb.executeSql(
            'INSERT OR IGNORE INTO pantry_categories (name, createdAt) VALUES (?, ?)',
            [cat, Date.now()],
          );
        }
        for (const item of items) {
          await this.pantryDb.executeSql(itemSql, [
            item.id,
            item.name,
            item.category,
            item.quantity,
            item.unit ?? null,
            item.notes ?? null,
            item.expirationMonth ?? null,
            item.expirationYear ?? null,
            item.createdAt,
            item.updatedAt,
          ]);
        }
        await this.pantryDb.executeSql('COMMIT');
      } catch (error) {
        await this.pantryDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.categories = categories;
        this.items = items;
      } else {
        const newCats = categories.filter((c) => !this.categories.includes(c));
        const existingIds = new Set(this.items.map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));
        this.categories = [...this.categories, ...newCats];
        this.items = [...this.items, ...newItems];
      }
    });
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    // Cleanup if needed
  }
}
