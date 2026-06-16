module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@maplibre|uuid|react-native-sensors|react-native-maps|astronomia)/)',
  ],
  moduleNameMapper: {
    '@react-native-async-storage/async-storage':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
    '@react-native-clipboard/clipboard':
      '<rootDir>/__mocks__/@react-native-clipboard/clipboard.ts',
    'react-native-fs': '<rootDir>/__mocks__/react-native-fs.ts',
    'react-native-maps': '<rootDir>/__mocks__/react-native-maps.tsx',
    '@maplibre/maplibre-react-native':
      '<rootDir>/__mocks__/@maplibre/maplibre-react-native.tsx',
  },
};
