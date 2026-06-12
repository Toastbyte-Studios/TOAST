import {
  COMMUNICATION_TOOLS,
  CORE_TOOLS,
  EARTH_TOOLS,
  MODULES,
  NAVIGATION_TOOLS,
  PREPPER_TOOLS,
  REFERENCE_TOOLS,
} from '../../constants';
import emergencyData from '../data/emergency.json';
import healthData from '../data/health.json';
import survivalData from '../data/survival.json';
import toolsData from '../data/tools.json';
import weatherData from '../data/weather.json';
import { InventoryItem } from '../stores/InventoryStore';
import { PantryItem } from '../stores/PantryStore';
import ReferenceEntryType from '../types/data-type';
import type { Checklist, ChecklistItem, Note } from '../stores';

export type SearchableItem = {
  id: string;
  title: string;
  type:
    | 'tool'
    | 'module'
    | 'reference'
    | 'note'
    | 'checklist'
    | 'inventory'
    | 'pantry';
  screen: string;
  icon: string;
  searchText: string; // Combined text for searching
  category?: string;
  data?: Record<string, unknown>; // Additional data for navigation
};

// Cache for static searchable items (tools, modules, reference) to improve performance
let cachedStaticItems: SearchableItem[] | null = null;

/**
 * Converts a tool to a searchable item
 */
function toolToSearchableItem(
  tool: { id: string; name: string; screen: string; icon: string },
  type: 'tool' | 'module',
): SearchableItem {
  return {
    id: tool.id,
    title: tool.name,
    type,
    screen: tool.screen,
    icon: tool.icon,
    searchText: tool.name.toLowerCase(),
  };
}

/**
 * Converts a reference entry to a searchable item
 */
function referenceEntryToSearchableItem(
  entry: ReferenceEntryType,
): SearchableItem {
  // Combine all searchable text fields
  const searchText = [
    entry.title,
    entry.summary,
    entry.category,
    ...(entry.tags || []),
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: entry.id,
    title: entry.title,
    type: 'reference',
    screen: 'Entry',
    icon: 'document-text-outline',
    searchText,
    category: entry.category,
    data: { entry },
  };
}

/**
 * Converts a note to a searchable item
 */
function noteToSearchableItem(note: Note): SearchableItem {
  // Combine all searchable text fields
  const searchText = [
    note.title || '',
    note.text || '',
    note.category || '',
    note.transcription || '',
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: note.id,
    title:
      note.title ||
      `Note from ${new Date(note.createdAt).toLocaleDateString()}`,
    type: 'note',
    screen: 'NoteEntry',
    icon: 'document-text-outline',
    searchText,
    category: note.category,
    data: { note },
  };
}

/**
 * Converts a checklist to a searchable item
 * Includes all checklist items in the search text
 */
function checklistToSearchableItem(
  checklist: Checklist,
  items: ChecklistItem[],
): SearchableItem {
  // Combine checklist name and all item texts for searching
  const checklistItems = items
    .filter((item) => item.checklistId === checklist.id)
    .map((item) => item.text);

  const searchText = [checklist.name, ...checklistItems]
    .join(' ')
    .toLowerCase();

  return {
    id: checklist.id,
    title: checklist.name,
    type: 'checklist',
    screen: 'ChecklistEntry',
    icon: 'checkmark-circle-outline',
    searchText,
    data: { checklist },
  };
}

/**
 * Converts an inventory item to a searchable item
 * Shows the category (list) it belongs to
 */
function inventoryItemToSearchableItem(item: InventoryItem): SearchableItem {
  // Combine all searchable text fields
  const searchText = [
    item.name,
    item.category,
    item.unit || '',
    item.notes || '',
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: item.id,
    title: `${item.name} (${item.category})`,
    type: 'inventory',
    screen: 'InventoryCategory',
    icon: 'cube-outline',
    searchText,
    category: item.category,
    data: { category: item.category },
  };
}

/**
 * Converts a pantry item to a searchable item
 * Shows the category (list) it belongs to
 */
function pantryItemToSearchableItem(item: PantryItem): SearchableItem {
  // Combine all searchable text fields
  const searchText = [
    item.name,
    item.category,
    item.unit || '',
    item.notes || '',
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: item.id,
    title: `${item.name} (${item.category})`,
    type: 'pantry',
    screen: 'PantryCategory',
    icon: 'restaurant-outline',
    searchText,
    category: item.category,
    data: { category: item.category },
  };
}

/**
 * Gets static searchable items (tools, modules, reference)
 * Results are cached to improve performance
 */
function getStaticSearchableItems(): SearchableItem[] {
  // Return cached items if available
  if (cachedStaticItems !== null) {
    return cachedStaticItems;
  }

  const items: SearchableItem[] = [];

  // Add modules
  MODULES.forEach((module) => {
    items.push(toolToSearchableItem(module, 'module'));
  });

  // Add all tools
  [
    ...CORE_TOOLS,
    ...COMMUNICATION_TOOLS,
    ...NAVIGATION_TOOLS,
    ...REFERENCE_TOOLS,
    ...PREPPER_TOOLS,
    ...EARTH_TOOLS,
  ].forEach((tool) => {
    items.push(toolToSearchableItem(tool, 'tool'));
  });

  // Add reference entries
  const allReferenceEntries = [
    ...healthData.entries,
    ...survivalData.entries,
    ...emergencyData.entries,
    ...toolsData.entries,
    ...weatherData.entries,
  ];

  allReferenceEntries.forEach((entry) => {
    items.push(referenceEntryToSearchableItem(entry));
  });

  // Cache the results
  cachedStaticItems = items;

  return items;
}

/**
 * Gets all searchable items in the app including dynamic data
 * @param notes - Array of notes from CoreStore
 * @param checklists - Array of checklists from CoreStore
 * @param checklistItems - Array of checklist items from CoreStore
 * @param inventoryItems - Array of inventory items from InventoryStore
 * @param pantryItems - Array of pantry items from PantryStore
 */
export function getAllSearchableItems(
  notes: Note[] = [],
  checklists: Checklist[] = [],
  checklistItems: ChecklistItem[] = [],
  inventoryItems: InventoryItem[] = [],
  pantryItems: PantryItem[] = [],
): SearchableItem[] {
  const items: SearchableItem[] = [];

  // Add static items (tools, modules, reference)
  items.push(...getStaticSearchableItems());

  // Add notes
  notes.forEach((note) => {
    items.push(noteToSearchableItem(note));
  });

  // Add checklists with their items
  checklists.forEach((checklist) => {
    items.push(checklistToSearchableItem(checklist, checklistItems));
  });

  // Add inventory items
  inventoryItems.forEach((item) => {
    items.push(inventoryItemToSearchableItem(item));
  });

  // Add pantry items
  pantryItems.forEach((item) => {
    items.push(pantryItemToSearchableItem(item));
  });

  return items;
}

/**
 * Searches items by query string
 * @param query - Search query string
 * @param notes - Array of notes from CoreStore
 * @param checklists - Array of checklists from CoreStore
 * @param checklistItems - Array of checklist items from CoreStore
 * @param inventoryItems - Array of inventory items from InventoryStore
 * @param pantryItems - Array of pantry items from PantryStore
 */
export function searchItems(
  query: string,
  notes: Note[] = [],
  checklists: Checklist[] = [],
  checklistItems: ChecklistItem[] = [],
  inventoryItems: InventoryItem[] = [],
  pantryItems: PantryItem[] = [],
): SearchableItem[] {
  if (!query || query.trim() === '') {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const allItems = getAllSearchableItems(
    notes,
    checklists,
    checklistItems,
    inventoryItems,
    pantryItems,
  );

  const results = allItems.filter((item) =>
    item.searchText.includes(normalizedQuery),
  );

  // Sort alphabetically by title
  return results.sort((a, b) => a.title.localeCompare(b.title));
}
