# MobX State Management

## Overview

ColdBoot uses MobX for reactive state management across the application. The store architecture is organized by domain with a central RootStore.

## Store Structure

```bash
src/stores/
├── index.ts              # Barrel export
├── RootStore.ts          # Root store combining all domain stores
├── StoreContext.tsx      # React context & hooks
├── CoreStore.ts          # Core module state
├── NavigationStore.ts    # Navigation module state
├── ReferenceStore.ts     # Reference module state
└── SignalsStore.ts       # Signals module state
```

## Usage

### Accessing Stores in Components

```tsx
import { observer } from 'mobx-react-lite';
import { useCoreStore, useNavigationStore } from '../../stores';

export default observer(function MyComponent() {
  const coreStore = useCoreStore();
  const navStore = useNavigationStore();

  return (
    <View>
      <Text>Total Tools: {coreStore.totalTools}</Text>
      <Button onPress={() => coreStore.toggleTool('flashlight')} />
    </View>
  );
});
```

### Store Features

#### CoreStore

- Manages flashlight and notepad tools

#### NavigationStore

- Stores map and compass tools
- Tracks current location coordinates
- Records last used timestamps

#### ReferenceStore

- Manages reference items and bookmarks
- Search functionality with filtering
- Add/remove references dynamically

#### SignalsStore

- Handles ham radio and bluetooth signals
- Scanning state management
- Filter by signal type and connection status

### Best Practices

1. **Always use `observer`**: Wrap components that read from stores with `observer()` to make them reactive.

2. **Use convenience hooks**: Import `useCoreStore()`, `useNavigationStore()`, etc. for cleaner code.

3. **Computed values**: Leverage MobX computed values (getters) for derived state.

4. **Actions**: All state mutations happen through store methods (actions).

5. **Type safety**: All stores and models are fully typed with TypeScript interfaces.

## Example: CoreModule Integration

See `src/modules/Core/CoreModule.tsx` for a complete example showing:

- Store hook usage
- Observer wrapper
- Reactive UI updates
- Action dispatching on user interaction

## Future Enhancements

- Persistence layer (AsyncStorage)
- Store hydration on app startup
- Middleware for logging/analytics
- API integration layer
