import { FlashlightModeType, ToolType } from './src/types/common-types';

export const FlashlightModes: FlashlightModeType = {
  OFF: 'off',
  ON: 'on',
  STROBE: 'strobe',
  SOS: 'sos',
  NIGHTVISION: 'nightvision',
};

export const MODULES: ToolType[] = [
  {
    name: 'Core',
    screen: 'CoreModule',
    icon: 'pulse-outline',
    id: 'home_core',
  },
  {
    name: 'Navigation',
    screen: 'NavigationModule',
    icon: 'compass-outline',
    id: 'home_navigation',
  },
  {
    name: 'Reference',
    screen: 'ReferenceModule',
    icon: 'book-outline',
    id: 'home_reference',
  },
  {
    name: 'Comms',
    screen: 'CommunicationsModule',
    icon: 'chatbubbles-outline',
    id: 'home_communications',
  },
  {
    name: 'Prepper',
    screen: 'PrepperModule',
    icon: 'shield-checkmark-outline',
    id: 'home_prepper',
  },
  {
    name: 'Earth',
    screen: 'EarthModule',
    icon: 'earth-outline',
    id: 'home_earth',
  },
];

export const CORE_TOOLS: ToolType[] = [
  {
    name: 'Device Status',
    screen: 'DeviceStatus',
    icon: 'speedometer-outline',
    id: 'core_device_status',
  },
  {
    name: 'Flashlight',
    screen: 'Flashlight',
    icon: 'flashlight-outline',
    id: 'core_flashlight',
  },
  {
    name: 'Voice Log',
    screen: 'VoiceLog',
    icon: 'mic-outline',
    id: 'core_voice_log',
  },
  {
    name: 'Notepad',
    screen: 'Notepad',
    icon: 'document-text-outline',
    id: 'core_notepad',
  },
  {
    name: 'Unit Conversion',
    screen: 'UnitConversion',
    icon: 'swap-horizontal-outline',
    id: 'core_unit_conversion',
  },
  {
    name: 'Checklist',
    screen: 'Checklist',
    icon: 'list-outline',
    id: 'core_checklist',
  },
];

export const EARTH_TOOLS: ToolType[] = [
  {
    name: 'Sun Times',
    screen: 'SunTime',
    icon: 'sunny-outline',
    id: 'earth_sun_time',
  },
  {
    name: 'Lunar Cycles',
    screen: 'LunarCycles',
    icon: 'moon-outline',
    id: 'earth_lunar_cycles',
  },
  {
    name: 'Barometric Pressure',
    screen: 'BarometricPressure',
    icon: 'analytics-outline',
    id: 'earth_barometric_pressure',
  },
  {
    name: 'Seasonal Outlook',
    screen: 'SeasonalOutlook',
    icon: 'calendar-outline',
    id: 'earth_seasonal_outlook',
  },
  {
    name: 'Sky Events',
    screen: 'SkyEvents',
    icon: 'telescope-outline',
    id: 'earth_sky_events',
  },
];

export const COMMUNICATION_TOOLS: ToolType[] = [
  {
    name: 'Morse Code',
    screen: 'MorseCode',
    icon: 'flash-outline',
    id: 'comm_morse_code',
  },
  {
    name: 'NATO Phonetic',
    screen: 'NatoPhonetic',
    icon: 'radio-outline',
    id: 'comm_nato_phonetic',
  },
  {
    name: 'Radio Frequency References',
    screen: 'RadioFrequencies',
    icon: 'cellular-outline',
    id: 'comm_radio_frequency',
  },
  {
    name: 'Digital Whistle',
    screen: 'DigitalWhistle',
    icon: 'megaphone-outline',
    id: 'comm_digital_whistle',
  },
  {
    name: 'Decibel Meter',
    screen: 'DecibelMeter',
    icon: 'volume-high-outline',
    id: 'comm_decibel_meter',
  },
  {
    name: 'Ground-to-Air Signals',
    screen: 'GroundToAirSignals',
    icon: 'navigate-outline',
    id: 'comm_ground_to_air',
  },
];

export const NAVIGATION_TOOLS: ToolType[] = [
  {
    name: 'Map',
    screen: 'MapScreen',
    icon: 'map-outline',
    id: 'nav_map',
  },
  {
    name: 'Star Map & Celestial Navigation',
    screen: 'StarMap',
    icon: 'star-outline',
    id: 'nav_star_map',
  },
  {
    name: 'Grid Reference Converter',
    screen: 'GridReference',
    icon: 'grid-outline',
    id: 'nav_grid_reference',
  },
  // DEV ONLY — throwaway MapLibre v11 rendering spike (see Toastbyte-Studios/TOAST#330).
  // Remove this entry when the production migration lands.
  ...(__DEV__
    ? [
        {
          name: 'Map Spike [DEV]',
          screen: 'MapSpike',
          icon: 'flask-outline',
          id: 'nav_map_spike_dev',
        },
      ]
    : []),
];

export const REFERENCE_TOOLS: ToolType[] = [
  {
    name: 'Health',
    screen: 'Health',
    icon: 'medkit-outline',
    id: 'ref_health',
  },
  {
    name: 'Survival Guide',
    screen: 'Survival',
    icon: 'leaf-outline',
    id: 'ref_survival_guide',
  },
  {
    name: 'Weather',
    screen: 'Weather',
    icon: 'rainy-outline',
    id: 'ref_weather',
  },
  {
    name: 'Tools & Knots',
    screen: 'ToolsAndKnots',
    icon: 'hammer-outline',
    id: 'ref_tools_knots',
  },
  {
    name: 'Emergency',
    screen: 'Emergency',
    icon: 'warning-outline',
    id: 'ref_emergency',
  },
];

export const PREPPER_TOOLS: ToolType[] = [
  {
    name: 'Depletion Calculator',
    screen: 'DepletionCalculator',
    icon: 'calculator-outline',
    id: 'prepper_depletion_calculator',
  },
  {
    name: 'Pantry',
    screen: 'Pantry',
    icon: 'nutrition-outline',
    id: 'prepper_pantry',
  },
  {
    name: 'Inventory',
    screen: 'Inventory',
    icon: 'cube-outline',
    id: 'prepper_inventory',
  },
  {
    name: 'Scenario Cards',
    screen: 'ScenarioCards',
    icon: 'albums-outline',
    id: 'prepper_scenario_cards',
  },
  {
    name: 'Barter Estimator',
    screen: 'BarterEstimator',
    icon: 'cash-outline',
    id: 'prepper_barter_estimator',
  },
  {
    name: 'Emergency Planner',
    screen: 'EmergencyPlan',
    icon: 'people-outline',
    id: 'prepper_emergency_planner',
  },
];
