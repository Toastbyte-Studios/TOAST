/**
 * @format
 * Tests for PantryStore functionality
 */

jest.mock('react-native-sqlite-storage', () => {
  // Return null to force in-memory storage mode (no default items created)
  return null;
});

// Silence the expected "SQLite not available" warning in tests
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { PantryStore } from '../src/stores/PantryStore';
import { PantryItem } from '../src/stores/PantryStore';

describe('PantryStore', () => {
  let store: PantryStore;

  beforeEach(() => {
    store = new PantryStore();
  });

  afterEach(() => {
    store.dispose();
  });

  describe('Category Management', () => {
    it('should initialize with empty categories', () => {
      expect(store.categories).toEqual([]);
    });

    it('should load default categories', async () => {
      await store.initDatabase();
      expect(store.categories).toEqual([
        'Canned Goods',
        'Dry Goods',
        'Frozen',
        'Fresh',
      ]);
    });

    it('should add a new category', async () => {
      await store.initDatabase();
      await store.addCategory('Beverages');
      expect(store.categories).toContain('Beverages');
    });

    it('should not add duplicate category', async () => {
      await store.initDatabase();
      await store.addCategory('Test Category');
      await expect(store.addCategory('Test Category')).rejects.toThrow(
        'Category already exists',
      );
    });

    it('should not add empty category', async () => {
      await store.initDatabase();
      await expect(store.addCategory('   ')).rejects.toThrow(
        'Category name cannot be empty',
      );
    });

    it('should delete a category', async () => {
      await store.initDatabase();
      await store.addCategory('Temporary');
      await store.deleteCategory('Temporary');
      expect(store.categories).not.toContain('Temporary');
    });

    it('should not delete last category', async () => {
      await store.initDatabase();
      // Remove all categories except one
      while (store.categories.length > 1) {
        await store.deleteCategory(store.categories[0]);
      }
      await expect(store.deleteCategory(store.categories[0])).rejects.toThrow(
        'Cannot delete the last category',
      );
    });
  });

  describe('Item Management', () => {
    beforeEach(async () => {
      await store.initDatabase();
    });

    it('should start with no items', () => {
      expect(store.items).toEqual([]);
    });

    it('should create a new item', async () => {
      const item = await store.createItem(
        'Canned Beans',
        'Canned Goods',
        10,
        'cans',
        'Black beans',
      );
      expect(item.name).toBe('Canned Beans');
      expect(item.quantity).toBe(10);
      expect(item.unit).toBe('cans');
      expect(item.category).toBe('Canned Goods');
      expect(store.items).toHaveLength(1);
    });

    it('should not create item with empty name', async () => {
      await expect(store.createItem('   ', 'Canned Goods', 1)).rejects.toThrow(
        'Item name cannot be empty',
      );
    });

    it('should not create item with negative quantity', async () => {
      await expect(
        store.createItem('Test Item', 'Canned Goods', -1),
      ).rejects.toThrow('Quantity cannot be negative');
    });

    it('should not create item with invalid category', async () => {
      await expect(
        store.createItem('Test Item', 'NonExistent', 1),
      ).rejects.toThrow('Invalid category');
    });

    it('should update an item', async () => {
      const item = await store.createItem('Rice', 'Dry Goods', 5, 'lbs');
      await store.updateItem(item.id, { quantity: 10 });
      expect(store.items[0].quantity).toBe(10);
    });

    it('should delete an item', async () => {
      const item = await store.createItem('Test', 'Canned Goods', 1);
      await store.deleteItem(item.id);
      expect(store.items).toHaveLength(0);
    });

    it('should not delete non-existent item', async () => {
      await expect(store.deleteItem('non-existent-id')).rejects.toThrow(
        'Item not found',
      );
    });
  });

  describe('Computed Properties', () => {
    beforeEach(async () => {
      await store.initDatabase();
    });

    it('should group items by category', async () => {
      await store.createItem('Item1', 'Canned Goods', 1);
      await store.createItem('Item2', 'Dry Goods', 1);
      await store.createItem('Item3', 'Canned Goods', 1);

      const grouped = store.itemsByCategory;
      expect(grouped['Canned Goods']).toHaveLength(2);
      expect(grouped['Dry Goods']).toHaveLength(1);
    });

    it('should return items sorted alphabetically', async () => {
      await store.createItem('Zucchini', 'Fresh', 1);
      await store.createItem('Apples', 'Fresh', 1);
      await store.createItem('Milk', 'Fresh', 1);

      const sorted = store.allItemsSorted;
      expect(sorted[0].name).toBe('Apples');
      expect(sorted[1].name).toBe('Milk');
      expect(sorted[2].name).toBe('Zucchini');
    });

    it('should get category item count', async () => {
      await store.createItem('Item1', 'Canned Goods', 1);
      await store.createItem('Item2', 'Canned Goods', 1);
      await store.createItem('Item3', 'Dry Goods', 1);

      expect(store.getCategoryItemCount('Canned Goods')).toBe(2);
      expect(store.getCategoryItemCount('Dry Goods')).toBe(1);
    });
  });

  describe('Category Deletion with Items', () => {
    beforeEach(async () => {
      await store.initDatabase();
    });

    it('should move items to fallback category when deleting category with items', async () => {
      await store.createItem('Item1', 'Canned Goods', 1);
      await store.createItem('Item2', 'Canned Goods', 1);

      await store.deleteCategory('Canned Goods', 'Dry Goods');

      expect(store.categories).not.toContain('Canned Goods');
      expect(store.items.every((item) => item.category === 'Dry Goods')).toBe(
        true,
      );
    });

    it('should require fallback category when deleting category with items', async () => {
      await store.createItem('Item1', 'Canned Goods', 1);

      await expect(store.deleteCategory('Canned Goods')).rejects.toThrow(
        'Fallback category required when category has items',
      );
    });
  });

  describe('Expiration Date Validation', () => {
    beforeEach(async () => {
      await store.initDatabase();
    });

    describe('createItem validation', () => {
      it('should reject invalid expiration month - zero', async () => {
        await expect(
          store.createItem('Test Item', 'Canned Goods', 1, 'cans', '', 0, 2025),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject invalid expiration month - negative', async () => {
        await expect(
          store.createItem(
            'Test Item',
            'Canned Goods',
            1,
            'cans',
            '',
            -1,
            2025,
          ),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject invalid expiration month - too high', async () => {
        await expect(
          store.createItem(
            'Test Item',
            'Canned Goods',
            1,
            'cans',
            '',
            13,
            2025,
          ),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject expiration year in the past', async () => {
        const currentYear = new Date().getFullYear();
        const pastYear = currentYear - 1;
        await expect(
          store.createItem(
            'Test Item',
            'Canned Goods',
            1,
            'cans',
            '',
            6,
            pastYear,
          ),
        ).rejects.toThrow(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      });

      it('should reject expiration year too far in the future', async () => {
        const currentYear = new Date().getFullYear();
        const farFutureYear = currentYear + 51;
        await expect(
          store.createItem(
            'Test Item',
            'Canned Goods',
            1,
            'cans',
            '',
            6,
            farFutureYear,
          ),
        ).rejects.toThrow(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      });

      it('should accept valid expiration dates - current year', async () => {
        const currentYear = new Date().getFullYear();
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
          '',
          6,
          currentYear,
        );
        expect(item.expirationMonth).toBe(6);
        expect(item.expirationYear).toBe(currentYear);
      });

      it('should accept valid expiration dates - future year', async () => {
        const currentYear = new Date().getFullYear();
        const futureYear = currentYear + 10;
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
          '',
          12,
          futureYear,
        );
        expect(item.expirationMonth).toBe(12);
        expect(item.expirationYear).toBe(futureYear);
      });

      it('should accept valid expiration dates - edge month 1', async () => {
        const currentYear = new Date().getFullYear();
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
          '',
          1,
          currentYear,
        );
        expect(item.expirationMonth).toBe(1);
      });

      it('should accept valid expiration dates - edge month 12', async () => {
        const currentYear = new Date().getFullYear();
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
          '',
          12,
          currentYear,
        );
        expect(item.expirationMonth).toBe(12);
      });

      it('should accept items without expiration dates', async () => {
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
        );
        expect(item.expirationMonth).toBeUndefined();
        expect(item.expirationYear).toBeUndefined();
      });
    });

    describe('updateItem validation', () => {
      it('should reject invalid expiration month - zero', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        await expect(
          store.updateItem(item.id, { expirationMonth: 0 }),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject invalid expiration month - negative', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        await expect(
          store.updateItem(item.id, { expirationMonth: -1 }),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject invalid expiration month - too high', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        await expect(
          store.updateItem(item.id, { expirationMonth: 13 }),
        ).rejects.toThrow('Expiration month must be between 1 and 12');
      });

      it('should reject expiration year in the past', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        const currentYear = new Date().getFullYear();
        const pastYear = currentYear - 1;
        await expect(
          store.updateItem(item.id, { expirationYear: pastYear }),
        ).rejects.toThrow(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      });

      it('should reject expiration year too far in the future', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        const currentYear = new Date().getFullYear();
        const farFutureYear = currentYear + 51;
        await expect(
          store.updateItem(item.id, { expirationYear: farFutureYear }),
        ).rejects.toThrow(
          `Expiration year must be between ${currentYear} and ${currentYear + 50}`,
        );
      });

      it('should accept valid expiration date updates', async () => {
        const item = await store.createItem('Test Item', 'Canned Goods', 1);
        const currentYear = new Date().getFullYear();
        await store.updateItem(item.id, {
          expirationMonth: 6,
          expirationYear: currentYear + 5,
        });
        expect(store.items[0].expirationMonth).toBe(6);
        expect(store.items[0].expirationYear).toBe(currentYear + 5);
      });

      it('should accept clearing expiration dates', async () => {
        const currentYear = new Date().getFullYear();
        const item = await store.createItem(
          'Test Item',
          'Canned Goods',
          1,
          'cans',
          '',
          6,
          currentYear,
        );
        await store.updateItem(item.id, {
          expirationMonth: undefined,
          expirationYear: undefined,
        });
        expect(store.items[0].expirationMonth).toBeUndefined();
        expect(store.items[0].expirationYear).toBeUndefined();
      });
    });
  });

  describe('Expiration Utilities', () => {
    beforeEach(async () => {
      await store.initDatabase();
    });

    describe('getExpirationDaysRemaining', () => {
      it('should return null for items without expiration date', async () => {
        const item = await store.createItem('No Expiry', 'Canned Goods', 1);
        expect(store.getExpirationDaysRemaining(item)).toBeNull();
      });

      it('should return null when only month is set (no year)', async () => {
        // Directly create a mock item with missing year
        const fakeItem = {
          id: 'fake',
          name: 'Test',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 6,
          expirationYear: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        expect(
          store.getExpirationDaysRemaining(fakeItem as PantryItem),
        ).toBeNull();
      });

      it('should return a positive number for a future expiration month', async () => {
        const now = new Date();
        // Use a month far in the future to guarantee positive days
        const futureYear = now.getFullYear() + 2;
        const item = await store.createItem(
          'Future Item',
          'Canned Goods',
          1,
          undefined,
          undefined,
          6,
          futureYear,
        );
        const days = store.getExpirationDaysRemaining(item);
        expect(days).not.toBeNull();
        expect(days!).toBeGreaterThan(0);
      });

      it('should return a negative-or-zero number for an expired item', () => {
        // Bypass validation by crafting an item with a past expiration date
        const pastItem = {
          id: 'past',
          name: 'Expired',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const days = store.getExpirationDaysRemaining(pastItem as PantryItem);
        expect(days).not.toBeNull();
        expect(days!).toBeLessThanOrEqual(0);
      });
    });

    describe('getExpirationStatus', () => {
      it('should return "none" for items without expiration date', async () => {
        const item = await store.createItem('No Expiry', 'Canned Goods', 1);
        expect(store.getExpirationStatus(item)).toBe('none');
      });

      it('should return "green" for items expiring in more than 30 days', async () => {
        const futureYear = new Date().getFullYear() + 2;
        const item = await store.createItem(
          'Green Item',
          'Canned Goods',
          1,
          undefined,
          undefined,
          6,
          futureYear,
        );
        expect(store.getExpirationStatus(item)).toBe('green');
      });

      it('should return "yellow" for items expiring within 30 days but not expired', () => {
        // Freeze time so the test is deterministic regardless of the real date.
        // Jan 15, 2024: end of January (Jan 31) is 16 days away — within 30 days but not expired.
        jest.useFakeTimers({ now: new Date(2024, 0, 15).getTime() });
        const yellowItem = {
          id: 'yellow',
          name: 'Yellow Item',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2024,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        expect(store.getExpirationStatus(yellowItem as PantryItem)).toBe(
          'yellow',
        );
        jest.useRealTimers();
      });

      it('should return "red" for expired items (past the expiration month)', () => {
        const expiredItem = {
          id: 'exp',
          name: 'Expired',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        expect(store.getExpirationStatus(expiredItem as PantryItem)).toBe(
          'red',
        );
      });
    });

    describe('itemsSortedByExpiration', () => {
      it('should exclude items without expiration dates', async () => {
        await store.createItem('No Expiry', 'Canned Goods', 1);
        const futureYear = new Date().getFullYear() + 1;
        await store.createItem(
          'Has Expiry',
          'Canned Goods',
          1,
          undefined,
          undefined,
          6,
          futureYear,
        );
        const sorted = store.itemsSortedByExpiration();
        expect(sorted.length).toBe(1);
        expect(sorted[0].name).toBe('Has Expiry');
      });

      it('should sort items soonest-first', async () => {
        const currentYear = new Date().getFullYear();
        const futureYear = currentYear + 5;
        await store.createItem(
          'Far Future',
          'Canned Goods',
          1,
          undefined,
          undefined,
          12,
          futureYear,
        );
        await store.createItem(
          'Near Future',
          'Canned Goods',
          1,
          undefined,
          undefined,
          6,
          currentYear + 1,
        );
        const sorted = store.itemsSortedByExpiration();
        expect(sorted[0].name).toBe('Near Future');
        expect(sorted[1].name).toBe('Far Future');
      });
    });

    describe('getExpirationAlerts', () => {
      it('should return empty array when no items have expiration dates', async () => {
        await store.createItem('No Expiry', 'Canned Goods', 1);
        expect(store.getExpirationAlerts()).toHaveLength(0);
      });

      it('should classify expired items as "expired"', () => {
        const expiredItem = {
          id: 'exp',
          name: 'Expired',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        // Manually push into store.items for this test
        store.items.push(expiredItem as PantryItem);
        const alerts = store.getExpirationAlerts();
        const expiredAlerts = alerts.filter((a) => a.alertType === 'expired');
        expect(expiredAlerts.length).toBeGreaterThan(0);
        expect(expiredAlerts[0].item.name).toBe('Expired');
      });

      it('should classify items expiring within 30 days as "30day"', () => {
        // Freeze time so the test is deterministic.
        // Jan 15, 2024: end of January (Jan 31) is 16 days away — within 30 days but not expired.
        jest.useFakeTimers({ now: new Date(2024, 0, 15).getTime() });
        const soonItem = {
          id: 'soon',
          name: 'Soon Item',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2024,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        store.items.push(soonItem as PantryItem);
        const alerts = store.getExpirationAlerts();
        const soonAlerts = alerts.filter((a) => a.item.name === 'Soon Item');
        expect(soonAlerts).toHaveLength(1);
        expect(soonAlerts[0].alertType).toBe('30day');
        jest.useRealTimers();
      });

      it('should not produce alerts for items expiring more than 30 days away', async () => {
        const futureYear = new Date().getFullYear() + 3;
        await store.createItem(
          'Safe Item',
          'Canned Goods',
          1,
          undefined,
          undefined,
          6,
          futureYear,
        );
        const alerts = store.getExpirationAlerts();
        const safeAlerts = alerts.filter((a) => a.item.name === 'Safe Item');
        expect(safeAlerts).toHaveLength(0);
      });

      it('should not have a "3day" alert tier', () => {
        // Verify the alert type is never '3day' regardless of proximity
        const expiredItem = {
          id: 'three-day-test',
          name: 'Three Day Item',
          category: 'Canned Goods',
          quantity: 1,
          expirationMonth: 1,
          expirationYear: 2000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        store.items.push(expiredItem as PantryItem);
        const alerts = store.getExpirationAlerts();
        expect(alerts.every((a) => a.alertType !== ('3day' as never))).toBe(
          true,
        );
      });
    });
  });
});
