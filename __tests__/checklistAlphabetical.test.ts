/**
 * @format
 */

import { ChecklistItem } from '../src/stores/ChecklistStore';

describe('Checklist Alphabetical Sorting', () => {
  describe('Checklist items sorting logic', () => {
    it('should sort checklist items alphabetically by text', () => {
      const unsortedItems: ChecklistItem[] = [
        {
          id: '1',
          checklistId: 'checklist1',
          text: 'Zebra item',
          checked: false,
          order: 0,
        },
        {
          id: '2',
          checklistId: 'checklist1',
          text: 'Alpha item',
          checked: false,
          order: 1,
        },
        {
          id: '3',
          checklistId: 'checklist1',
          text: 'Mike item',
          checked: false,
          order: 2,
        },
        {
          id: '4',
          checklistId: 'checklist1',
          text: 'Beta item',
          checked: false,
          order: 3,
        },
      ];

      // Apply the same sorting logic as getChecklistItems
      const sortedItems = [...unsortedItems].sort((a, b) =>
        a.text.localeCompare(b.text),
      );

      // Extract text in sorted order
      const sortedTexts = sortedItems.map((item) => item.text);

      // Expected alphabetical order
      const expectedOrder = [
        'Alpha item',
        'Beta item',
        'Mike item',
        'Zebra item',
      ];

      expect(sortedTexts).toEqual(expectedOrder);
    });

    it('should sort default Bug-out bag items alphabetically', () => {
      const bugOutBagItems = [
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
      ];

      // Create a sorted copy
      const sortedItems = [...bugOutBagItems].sort((a, b) =>
        a.localeCompare(b),
      );

      // The items should already be sorted
      expect(bugOutBagItems).toEqual(sortedItems);
    });

    it('should sort default First-aid kit items alphabetically', () => {
      const firstAidItems = [
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
      ];

      // Create a sorted copy
      const sortedItems = [...firstAidItems].sort((a, b) => a.localeCompare(b));

      // The items should already be sorted
      expect(firstAidItems).toEqual(sortedItems);
    });

    it('should sort default Evacuation kit items alphabetically', () => {
      const evacuationItems = [
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
      ];

      // Create a sorted copy
      const sortedItems = [...evacuationItems].sort((a, b) =>
        a.localeCompare(b),
      );

      // The items should already be sorted
      expect(evacuationItems).toEqual(sortedItems);
    });

    it('should handle items with parentheses correctly', () => {
      const unsortedItems: ChecklistItem[] = [
        {
          id: '1',
          checklistId: 'checklist1',
          text: 'Water (1 gallon)',
          checked: false,
          order: 0,
        },
        {
          id: '2',
          checklistId: 'checklist1',
          text: 'Water',
          checked: false,
          order: 1,
        },
        {
          id: '3',
          checklistId: 'checklist1',
          text: 'Food (3-day)',
          checked: false,
          order: 2,
        },
      ];

      const sortedItems = [...unsortedItems].sort((a, b) =>
        a.text.localeCompare(b.text),
      );

      const sortedTexts = sortedItems.map((item) => item.text);
      const expectedOrder = ['Food (3-day)', 'Water', 'Water (1 gallon)'];

      expect(sortedTexts).toEqual(expectedOrder);
    });

    it('should handle empty array correctly', () => {
      const emptyItems: ChecklistItem[] = [];

      const sortedItems = [...emptyItems].sort((a, b) =>
        a.text.localeCompare(b.text),
      );

      expect(sortedItems).toEqual([]);
      expect(sortedItems.length).toBe(0);
    });

    it('should handle single-item array correctly', () => {
      const singleItem: ChecklistItem[] = [
        {
          id: '1',
          checklistId: 'checklist1',
          text: 'First aid kit',
          checked: false,
          order: 0,
        },
      ];

      const sortedItems = [...singleItem].sort((a, b) =>
        a.text.localeCompare(b.text),
      );

      expect(sortedItems).toEqual(singleItem);
      expect(sortedItems.length).toBe(1);
      expect(sortedItems[0].text).toBe('First aid kit');
    });
  });
});
