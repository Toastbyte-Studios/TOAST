/**
 * @format
 */

import { NavigationHistory } from '../src/navigation/navigationHistory';

// Mock the @react-navigation/native module
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    navigate: (params: Record<string, unknown>) => ({
      type: 'NAVIGATE',
      payload: params,
    }),
  },
}));

// Mock navigation ref with minimal required interface
const createMockNavigationRef = () => {
  const mockState = {
    routes: [{ key: 'route1', name: 'Home' }],
  };

  const mockCurrentRoute = {
    key: 'route1',
    name: 'Home',
    params: undefined,
  };

  return {
    isReady: jest.fn(() => true),
    getRootState: jest.fn(() => mockState),
    getCurrentRoute: jest.fn(() => mockCurrentRoute),
    dispatch: jest.fn(),
    mockState,
    mockCurrentRoute,
  };
};

describe('NavigationHistory', () => {
  let navigationRef: ReturnType<typeof createMockNavigationRef>;
  let navigationHistory: NavigationHistory;

  beforeEach(() => {
    jest.clearAllMocks();
    navigationRef = createMockNavigationRef();
    navigationHistory = new NavigationHistory(navigationRef);
  });

  describe('constructor', () => {
    it('should throw error if navigationRef is null', () => {
      expect(
        () =>
          new NavigationHistory(
            null as unknown as ReturnType<typeof createMockNavigationRef>,
          ),
      ).toThrow('NavigationHistory requires a valid navigationRef');
    });

    it('should throw error if navigationRef is undefined', () => {
      expect(
        () =>
          new NavigationHistory(
            undefined as unknown as ReturnType<typeof createMockNavigationRef>,
          ),
      ).toThrow('NavigationHistory requires a valid navigationRef');
    });
  });

  describe('canGoForward', () => {
    it('should return false when forward stack is empty', () => {
      expect(navigationHistory.canGoForward()).toBe(false);
    });

    it('should return true after a back navigation', () => {
      // Initial state: Home screen with 1 route
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Navigate to Screen2
      navigationRef.mockState = {
        routes: [
          { key: 'route1', name: 'Home' },
          { key: 'route2', name: 'Screen2' },
        ],
      };
      navigationRef.mockCurrentRoute = {
        key: 'route2',
        name: 'Screen2',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Navigate back to Home
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Should be able to go forward now
      expect(navigationHistory.canGoForward()).toBe(true);
    });
  });

  describe('goForward', () => {
    it('should do nothing if navigation is not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      navigationHistory.goForward();
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
    });

    it('should do nothing if forward stack is empty', () => {
      navigationHistory.goForward();
      expect(navigationRef.dispatch).not.toHaveBeenCalled();
    });

    it('should navigate to the next route in the forward stack', () => {
      // Setup: navigate from Home to Screen2, then back to Home
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      navigationRef.mockState = {
        routes: [
          { key: 'route1', name: 'Home' },
          { key: 'route2', name: 'Screen2' },
        ],
      };
      navigationRef.mockCurrentRoute = {
        key: 'route2',
        name: 'Screen2',
        params: { test: 'value' },
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Execute forward navigation
      navigationHistory.goForward();

      // Should dispatch navigate action with the saved route
      expect(navigationRef.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NAVIGATE',
          payload: {
            name: 'Screen2',
            params: { test: 'value' },
          },
        }),
      );
    });
  });

  describe('onNavigationStateChange', () => {
    it('should do nothing if navigation is not ready', () => {
      (navigationRef.isReady as jest.Mock).mockReturnValue(false);
      navigationHistory.onNavigationStateChange();
      expect(navigationHistory.canGoForward()).toBe(false);
    });

    it('should clear forward stack on new navigation', () => {
      // Navigate from Home to Screen2
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      navigationRef.mockState = {
        routes: [
          { key: 'route1', name: 'Home' },
          { key: 'route2', name: 'Screen2' },
        ],
      };
      navigationRef.mockCurrentRoute = {
        key: 'route2',
        name: 'Screen2',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Go back
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      expect(navigationHistory.canGoForward()).toBe(true);

      // Navigate to a new screen (not using forward)
      navigationRef.mockState = {
        routes: [
          { key: 'route1', name: 'Home' },
          { key: 'route3', name: 'Screen3' },
        ],
      };
      navigationRef.mockCurrentRoute = {
        key: 'route3',
        name: 'Screen3',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      // Forward stack should be cleared
      expect(navigationHistory.canGoForward()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all internal state', () => {
      // Setup some state
      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      navigationRef.mockState = {
        routes: [
          { key: 'route1', name: 'Home' },
          { key: 'route2', name: 'Screen2' },
        ],
      };
      navigationRef.mockCurrentRoute = {
        key: 'route2',
        name: 'Screen2',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      navigationRef.mockState = { routes: [{ key: 'route1', name: 'Home' }] };
      navigationRef.mockCurrentRoute = {
        key: 'route1',
        name: 'Home',
        params: undefined,
      };
      (navigationRef.getRootState as jest.Mock).mockReturnValue(
        navigationRef.mockState,
      );
      (navigationRef.getCurrentRoute as jest.Mock).mockReturnValue(
        navigationRef.mockCurrentRoute,
      );
      navigationHistory.onNavigationStateChange();

      expect(navigationHistory.canGoForward()).toBe(true);

      // Reset
      navigationHistory.reset();

      // All state should be cleared
      expect(navigationHistory.canGoForward()).toBe(false);
    });
  });
});
