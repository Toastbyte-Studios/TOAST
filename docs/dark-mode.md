# Dark Mode Feature

## Overview

The ColdBoot app now supports dark mode with three theme options that can be configured in the Settings modal.

## Theme Options

### 1. System (Default)

- Automatically matches your device's system theme setting
- Switches between light and dark as your system preference changes
- Provides seamless integration with your device's appearance settings
- Ensures consistent experience on app startup

### 2. Light Mode

- Cool, high-contrast theme tuned for outdoor glare
- Uses the ColdBoot "glacier" palette
- Best for daytime use and well-lit environments

### 3. Dark Mode

- Dark theme optimized for low-light conditions
- Inverted color scheme with darker backgrounds
- Reduces eye strain in dark environments
- Better for nighttime use and battery life (on OLED screens)

## How to Change Theme

1. Tap the **Settings icon** (gear icon) in the top-right corner of any screen
2. In the Settings modal, scroll to the **Theme** section
3. Select your preferred theme:
   - **Light Mode** - Always use light theme
   - **Dark Mode** - Always use dark theme
   - **System** - Match system settings
4. The theme will change immediately
5. Your preference is automatically saved and will persist through app restarts

## Technical Details

### For Users

- Theme preference is stored locally on your device
- No internet connection required
- Changes take effect immediately
- Setting is preserved when you close and reopen the app

### For Developers

- Theme implementation uses React Native's `useColorScheme` hook
- Colors are dynamically applied via the `useTheme` custom hook
- Theme preference is persisted in SQLite database via `SettingsStore`
- All theme-related logic is centralized for easy maintenance
- New components can adopt theming by importing and using `useTheme()` hook

## Color Palette

### Light Mode

- Background: Pale ice blue (`#DCECF7`)
- Text: Near-black ink (`#1D1F20`)
- Brand: Steel blue (`#2F5875`)
- Accents: Signal amber (`#B45309`) and cold teal (`#2F6F7A`)

### Dark Mode

- Background: Deep slate (`#101B24`)
- Text: Pale ice (`#DCECF7`)
- Brand: Pale steel (`#8FB6CE`)
- Accents: Signal amber (`#FFB020`) and cold teal (`#5E9BA8`), both lifted for dark backgrounds

Dark mode is the hero scheme. Tokens are defined in `src/theme/colors.ts`.

## Accessibility

- Both themes maintain proper contrast ratios for readability
- Color choices follow accessibility guidelines
- Text remains legible in both modes
