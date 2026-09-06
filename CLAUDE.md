# ColdBoot — Claude Code Instructions

ColdBoot is a fully **offline-first** React Native app for iOS and Android.

---

## Stack

| Concern     | Library                                                |
| ----------- | ------------------------------------------------------ |
| Framework   | React Native 0.84 / React 19                           |
| Language    | TypeScript 5.8 strict                                  |
| State       | MobX 6 + mobx-react-lite                               |
| Navigation  | @react-navigation/native-stack                         |
| Validation  | Zod 4                                                  |
| Persistence | react-native-sqlite-storage + AsyncStorage             |
| Icons       | react-native-vector-icons (Ionicons, outline variants) |
| Testing     | Jest 29 (React Native preset)                          |

---

## Key Commands

```bash
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
npm run lint          # ESLint check
npm run format        # Prettier format
npm test              # Jest
npm run cleanup       # clean + format + lint + test
```

There is no `tsc --noEmit` script; run it manually to check types.

---

## Project Structure

```text
src/
  components/     # Shared UI components (ScreenBody, CardTopic, Grid, etc.)
  hooks/          # Custom hooks (useTheme, useDeviceStatus, etc.)
  modules/        # Module-level screens (CoreModule, PrepperModule, etc.)
  navigation/     # AppNavigator, navigationRef, NavigationHistoryContext
  screens/        # Feature screens grouped by domain
  stores/         # MobX stores (RootStore + 15 domain stores)
  theme/          # Color schemes, spacing constants, gradient definitions
  types/          # TypeScript type definitions
  utils/          # Pure utility functions
  data/           # Static JSON data files (health, survival, weather, etc.)
```

---

## Architecture Patterns

### Screens

- Each screen lives at `src/screens/<Feature>/<FeatureScreen>.tsx`
- Screens are always wrapped with `observer()` from `mobx-react-lite`
- Screens access state via store hooks, not raw context
- Layout: `ScreenBody` > content — never build your own scroll/padding wrapper

```tsx
import { observer } from 'mobx-react-lite';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useCoreStore } from '../../stores/StoreContext';

const MyScreen = observer(() => {
  const core = useCoreStore();
  return (
    <ScreenBody>
      <SectionHeader>My Feature</SectionHeader>
      {/* content */}
    </ScreenBody>
  );
});

export default MyScreen;
```

### State (MobX)

- `RootStore` owns all stores; accessed via `StoreProvider` + `useStores()` or per-store hooks
- Always call `makeAutoObservable(this, {}, { autoBind: true })` in store constructors
- Wrap async state updates in `runInAction()`
- Store hooks: `useCoreStore()`, `useInventoryStore()`, `usePantryStore()`, `useSettingsStore()`, etc.
- New stores must be added to `RootStore` and exported from `StoreContext`

### Theming

- **In screen components**: use the `useTheme()` hook — it returns `ColorScheme` and responds to system/dark/light mode
- **In containers (non-component files)**: import `COLORS` as a constant from `../../../theme` — do **not** use `useTheme()` here
- Never hardcode color values; always reference the theme
- Spacing constants: `SPACING.xs/sm/md/lg/xl` (4/8/12/16/24) and `FOOTER_HEIGHT`, `SCROLL_PADDING` from `src/theme/constants.ts`

### Navigation

- All routes are defined in `src/navigation/AppNavigator.tsx` (native stack, headers hidden by default)
- Route names use PascalCase matching their screen filename (e.g., `"DepletionCalculator"`)
- Navigate via `useNavigation()` hook inside components
- Register new routes in `AppNavigator.tsx` and add the tool entry to the relevant `*_TOOLS` constant in `constants.ts`

### New Features / Tools

When adding a new tool:

1. Create `src/screens/<Feature>/<FeatureScreen>.tsx`
2. Add a route to `AppNavigator.tsx`
3. Add the tool entry to the appropriate `*_TOOLS` constant in `constants.ts` (with an Ionicons `*-outline` icon name)
4. If it needs state, create `src/stores/<Domain>Store.ts` and wire it into `RootStore`

---

## Code Conventions

### TypeScript

- Strict mode is on — no implicit `any`, no non-null assertions without justification
- Use Zod for runtime validation at data boundaries (SQLite, AsyncStorage, JSON files)
- Type files live in `src/types/<domain>-types.ts`

### ESLint / Prettier

- Import order is **enforced**: builtin → external → internal → parent → sibling → index (alphabetical within each group)
- Prettier: 80-char width, 2-space indent, single quotes, trailing commas, no semicolons override (default on)
- Run `npm run lint` before committing; violations block CI

### Icons

- Always use Ionicons **outline** variants (e.g., `"flashlight-outline"`, not `"flashlight"`)

### Styles

- Define styles with `StyleSheet.create()` at the bottom of each file
- Don't share StyleSheet objects across files; co-locate styles with their component
- At no point should the content ever bleed into the footer. Wrap screen content in `ScreenBody` for consistent layout, but do not assume it automatically applies footer-height bottom padding; add the required bottom spacing explicitly on screens that render above the footer.

---

## Testing

- Test files: `<name>.test.ts` or `<name>.test.tsx`, co-located or in `__mocks__/`
- Mocks for native modules live in `__mocks__/` at the repo root
- Transform ignore patterns cover: `uuid`, `react-native-sensors`, `react-native-maps`, `astronomia`
- Don't mock SQLite stores in integration tests — the prior approach caused prod/mock divergence

---

## Known Pre-existing Issues (do not fix unless assigned)

- `demStorage.ts`, `fileOps.ts`: `atob`/`btoa` not available (needs DOM lib or polyfill)
- `mbtilesWriter.ts`: no types for `react-native-sqlite-storage`
- `geoIndex.ts`: Zod v4 `z.record()` workaround; type issue in cells Record
- `schemas.ts`: Zod v4 `ZodIssueCode.too_small` API change
- Offline maps map rendering uses `StubMapAdapter` (MapLibre integration pending)

---

## What NOT to Do

- Do not make network requests — this app is fully offline
- Do not use `useTheme()` inside containers or non-component utility code; use the `COLORS` constant
- Do not recreate service/repo/store instances on each render — use `useMemo` in containers
- Do not add `makeObservable` manual decorators; use `makeAutoObservable`
- Do not hardcode colors, spacing, or font sizes — use theme/constants
