import { NetworkManager } from '@maplibre/maplibre-react-native';
import { DevToolsStore } from '../src/stores/DevToolsStore';

jest.mock('@maplibre/maplibre-react-native', () => ({
  NetworkManager: {
    setConnected: jest.fn(),
  },
}));

describe('DevToolsStore', () => {
  let store: DevToolsStore;
  const setConnectedMock = jest.mocked(NetworkManager.setConnected);

  beforeEach(() => {
    store = new DevToolsStore();
    jest.clearAllMocks();
  });

  it('starts with simulatedOffline disabled', () => {
    expect(store.simulatedOffline).toBe(false);
  });

  it('inverts the value for NetworkManager.setConnected', () => {
    store.setSimulatedOffline(true);
    expect(setConnectedMock).toHaveBeenCalledWith(false);
    expect(store.simulatedOffline).toBe(true);
  });

  it('leaves simulatedOffline unchanged when native call fails', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setConnectedMock.mockImplementationOnce(() => {
      throw new Error('native failure');
    });

    store.setSimulatedOffline(true);

    expect(setConnectedMock).toHaveBeenCalledWith(false);
    expect(store.simulatedOffline).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'DevToolsStore: NetworkManager.setConnected failed',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it('restores connectivity on dispose when offline was simulated', () => {
    store.setSimulatedOffline(true);
    setConnectedMock.mockClear();

    store.dispose();

    expect(setConnectedMock).toHaveBeenCalledWith(true);
  });

  it('does not call restore when already connected', () => {
    store.dispose();
    expect(setConnectedMock).not.toHaveBeenCalled();
  });
});
