import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useInventoryStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';

/**
 * Screen for managing inventory categories.
 *
 * Allows users to:
 * - View all categories
 * - Add new categories
 * - Delete existing categories (with warnings)
 *
 * @returns {React.JSX.Element} The rendered manage inventory categories screen component.
 */
export default observer(
  function ManageInventoryCategoriesScreen(): React.JSX.Element {
    const inventory = useInventoryStore();
    const COLORS = useTheme();
    const [newCategoryName, setNewCategoryName] = useState<string>('');
    const [isAdding, setIsAdding] = useState<boolean>(false);

    const handleAddCategory = async () => {
      const trimmedName = newCategoryName.trim();
      if (!trimmedName) {
        Alert.alert('Error', 'Category name cannot be empty');
        return;
      }
      try {
        await inventory.addCategory(trimmedName);
        setNewCategoryName('');
        setIsAdding(false);
        Alert.alert('Success', `Category "${trimmedName}" added successfully`);
      } catch (error) {
        Alert.alert('Error', error.message || 'Failed to add category');
      }
    };

    const handleDeleteCategory = (categoryName: string) => {
      const itemCount = inventory.getCategoryItemCount(categoryName);

      if (itemCount === 0) {
        // No items in category - single warning
        Alert.alert(
          'Delete Category',
          `Are you sure you want to delete the category "${categoryName}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await inventory.deleteCategory(categoryName);
                } catch (error) {
                  Alert.alert(
                    'Error',
                    error.message || 'Failed to delete category',
                  );
                }
              },
            },
          ],
        );
      } else {
        // Category has items - first warning
        Alert.alert(
          'Delete Category',
          `This category contains ${itemCount} item${itemCount > 1 ? 's' : ''}. Are you sure you want to delete it?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => {
                // Second warning with reassignment confirmation
                const fallbackCategory = inventory.categories.find(
                  (c) => c !== categoryName,
                );
                if (!fallbackCategory) {
                  Alert.alert('Error', 'No fallback category available');
                  return;
                }
                // Capture item count before async operation to ensure accurate messaging
                const movedItemCount = itemCount;
                Alert.alert(
                  'Confirm Deletion',
                  `All items in "${categoryName}" will be moved to "${fallbackCategory}". This action cannot be undone. Delete anyway?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await inventory.deleteCategory(
                            categoryName,
                            fallbackCategory,
                          );
                          Alert.alert(
                            'Success',
                            `Category deleted. ${movedItemCount} item${movedItemCount > 1 ? 's' : ''} moved to "${fallbackCategory}"`,
                          );
                        } catch (error) {
                          Alert.alert(
                            'Error',
                            error.message || 'Failed to delete category',
                          );
                        }
                      },
                    },
                  ],
                );
              },
            },
          ],
        );
      }
    };

    return (
      <ScreenBody>
        <SectionHeader>Manage Inventory Categories</SectionHeader>
        <View style={styles.container}>
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: COLORS.PRIMARY_DARK },
              ]}
              onPress={() => setIsAdding(!isAdding)}
              accessibilityLabel="Add new category"
              accessibilityRole="button"
            >
              <Icon
                name={isAdding ? 'close-outline' : 'add-outline'}
                size={24}
                color={COLORS.PRIMARY_LIGHT}
              />
              <Text
                style={[styles.addButtonText, { color: COLORS.PRIMARY_LIGHT }]}
              >
                {isAdding ? 'Cancel' : 'Add Category'}
              </Text>
            </TouchableOpacity>
          </View>

          {isAdding && (
            <View style={styles.addCategoryForm}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: COLORS.PRIMARY_LIGHT,
                    borderColor: COLORS.SECONDARY_ACCENT,
                    color: COLORS.PRIMARY_DARK,
                  },
                ]}
                placeholder="Category name..."
                placeholderTextColor={COLORS.PRIMARY_DARK}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus
                accessibilityLabel="Enter category name"
              />
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: COLORS.PRIMARY_DARK },
                  !newCategoryName.trim() && styles.disabledButton,
                ]}
                onPress={handleAddCategory}
                disabled={!newCategoryName.trim()}
                accessibilityLabel="Save new category"
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: COLORS.PRIMARY_LIGHT },
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {inventory.categories.length === 0 ? (
              <Text style={styles.emptyText}>No categories yet.</Text>
            ) : (
              inventory.categories.map((category) => {
                const itemCount = inventory.getCategoryItemCount(category);
                return (
                  <View
                    key={category}
                    style={[
                      styles.categoryItem,
                      {
                        backgroundColor: COLORS.PRIMARY_LIGHT,
                        borderColor: COLORS.SECONDARY_ACCENT,
                      },
                    ]}
                  >
                    <View style={styles.categoryInfo}>
                      <Icon
                        name="folder-outline"
                        size={24}
                        color={COLORS.PRIMARY_DARK}
                        style={styles.categoryIcon}
                      />
                      <View style={styles.categoryTextContainer}>
                        <Text
                          style={[
                            styles.categoryName,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {category}
                        </Text>
                        <Text
                          style={[
                            styles.categoryCount,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteCategory(category)}
                      accessibilityLabel={`Delete ${category} category`}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="trash-outline"
                        size={22}
                        color={COLORS.ERROR || '#d32f2f'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </ScreenBody>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingBottom: FOOTER_HEIGHT,
  },
  headerSection: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addCategoryForm: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  saveButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 6,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 24,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    marginRight: 12,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 13,
    opacity: 0.7,
  },
  deleteButton: {
    padding: 8,
  },
});
