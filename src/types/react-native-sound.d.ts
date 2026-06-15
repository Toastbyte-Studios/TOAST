declare module 'react-native-sound' {
  export default class Sound {
    constructor(
      filename: string,
      basePath: string,
      onError?: (error: Error | null) => void,
    );

    static MAIN_BUNDLE: string;
    static setCategory(category: string): void;

    play(onEnd?: (success: boolean) => void): void;
    stop(callback?: () => void): void;
    release(): void;
    setVolume(volume: number): void;
    setNumberOfLoops(loops: number): void;
  }
}
