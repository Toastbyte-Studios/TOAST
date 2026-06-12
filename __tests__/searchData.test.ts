/**
 * @format
 */

import { Checklist, ChecklistItem } from '../src/stores/ChecklistStore';
import { Note } from '../src/stores/CoreStore';
import { InventoryItem } from '../src/stores/InventoryStore';
import { PantryItem } from '../src/stores/PantryStore';
import { searchItems, getAllSearchableItems } from '../src/utils/searchData';

describe('Search Functionality', () => {
  // Mock data for testing
  const mockNotes: Note[] = [
    {
      id: 'note1',
      createdAt: Date.now(),
      category: 'General',
      type: 'text',
      title: 'Test Note About Fire Safety',
      text: 'This is a note about fire safety',
      photoUris: [],
    },
  ];

  const mockChecklists: Checklist[] = [
    {
      id: 'checklist1',
      name: 'Emergency Checklist',
      createdAt: Date.now(),
      isDefault: false,
    },
  ];

  const mockChecklistItems: ChecklistItem[] = [
    {
      id: 'item1',
      checklistId: 'checklist1',
      text: 'Check fire extinguisher',
      checked: false,
      order: 0,
    },
  ];

  const mockInventoryItems: InventoryItem[] = [
    {
      id: 'inv1',
      name: 'Water Bottles',
      category: 'Home Base',
      quantity: 10,
      unit: 'bottles',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockPantryItems: PantryItem[] = [
    {
      id: 'pantry1',
      name: 'Canned Beans',
      category: 'Canned Goods',
      quantity: 5,
      unit: 'cans',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  test('getAllSearchableItems returns non-empty array', () => {
    const items = getAllSearchableItems();
    expect(items.length).toBeGreaterThan(0);
  });

  test('getAllSearchableItems includes notes when provided', () => {
    const items = getAllSearchableItems(mockNotes);
    const noteItem = items.find((item) => item.type === 'note');
    expect(noteItem).toBeDefined();
    expect(noteItem?.title).toContain('Test Note');
  });

  test('getAllSearchableItems includes checklists when provided', () => {
    const items = getAllSearchableItems([], mockChecklists, mockChecklistItems);
    const checklistItem = items.find((item) => item.type === 'checklist');
    expect(checklistItem).toBeDefined();
    expect(checklistItem?.title).toBe('Emergency Checklist');
  });

  test('getAllSearchableItems includes inventory items when provided', () => {
    const items = getAllSearchableItems([], [], [], mockInventoryItems);
    const inventoryItem = items.find((item) => item.type === 'inventory');
    expect(inventoryItem).toBeDefined();
    expect(inventoryItem?.title).toContain('Water Bottles');
  });

  test('getAllSearchableItems includes pantry items when provided', () => {
    const items = getAllSearchableItems([], [], [], [], mockPantryItems);
    const pantryItem = items.find((item) => item.type === 'pantry');
    expect(pantryItem).toBeDefined();
    expect(pantryItem?.title).toContain('Canned Beans');
  });

  test('searchItems returns empty array for empty query', () => {
    const results = searchItems('');
    expect(results).toEqual([]);
  });

  test('searchItems returns empty array for whitespace query', () => {
    const results = searchItems('   ');
    expect(results).toEqual([]);
  });

  test('searchItems finds Core module', () => {
    const results = searchItems('core');
    expect(results.length).toBeGreaterThan(0);
    const coreModule = results.find((item) => item.id === 'home_core');
    expect(coreModule).toBeDefined();
    expect(coreModule?.title).toBe('Core');
  });

  test('searchItems finds Flashlight tool', () => {
    const results = searchItems('flashlight');
    expect(results.length).toBeGreaterThan(0);
    const flashlight = results.find((item) => item.id === 'core_flashlight');
    expect(flashlight).toBeDefined();
    expect(flashlight?.title).toBe('Flashlight');
  });

  test('searchItems is case insensitive', () => {
    const resultsLower = searchItems('morse');
    const resultsUpper = searchItems('MORSE');
    const resultsMixed = searchItems('MoRsE');
    expect(resultsLower.length).toBeGreaterThan(0);
    expect(resultsLower.length).toEqual(resultsUpper.length);
    expect(resultsLower.length).toEqual(resultsMixed.length);
  });

  test('searchItems finds reference entries by title', () => {
    const results = searchItems('fire');
    expect(results.length).toBeGreaterThan(0);
    const fireEntry = results.find(
      (item) => item.type === 'reference' && item.searchText.includes('fire'),
    );
    expect(fireEntry).toBeDefined();
  });

  test('searchItems finds notes', () => {
    const results = searchItems('fire safety', mockNotes);
    expect(results.length).toBeGreaterThan(0);
    const noteResult = results.find((item) => item.type === 'note');
    expect(noteResult).toBeDefined();
  });

  test('searchItems finds checklist items', () => {
    const results = searchItems(
      'extinguisher',
      [],
      mockChecklists,
      mockChecklistItems,
    );
    expect(results.length).toBeGreaterThan(0);
    const checklistResult = results.find((item) => item.type === 'checklist');
    expect(checklistResult).toBeDefined();
  });

  test('searchItems finds inventory items', () => {
    const results = searchItems('water', [], [], [], mockInventoryItems);
    expect(results.length).toBeGreaterThan(0);
    const inventoryResult = results.find((item) => item.type === 'inventory');
    expect(inventoryResult).toBeDefined();
  });

  test('searchItems finds pantry items', () => {
    const results = searchItems('beans', [], [], [], [], mockPantryItems);
    expect(results.length).toBeGreaterThan(0);
    const pantryResult = results.find((item) => item.type === 'pantry');
    expect(pantryResult).toBeDefined();
  });

  test('searchItems returns results sorted alphabetically', () => {
    const results = searchItems('a');
    expect(results.length).toBeGreaterThan(1);
    for (let i = 0; i < results.length - 1; i++) {
      expect(
        results[i].title.localeCompare(results[i + 1].title),
      ).toBeLessThanOrEqual(0);
    }
  });

  test('searchItems handles partial matches', () => {
    const results = searchItems('comm');
    expect(results.length).toBeGreaterThan(0);
    // Should find "Comms" module and "Communications" related items
    const commsModule = results.find((item) => item.title === 'Comms');
    expect(commsModule).toBeDefined();
  });

  test('searchItems finds items by tags', () => {
    // Search for a common tag like "survival"
    const results = searchItems('survival');
    expect(results.length).toBeGreaterThan(0);
    const survivalItem = results.find((item) => item.type === 'reference');
    expect(survivalItem).toBeDefined();
  });
});
