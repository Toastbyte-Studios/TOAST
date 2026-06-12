/**
 * Mock for react-native-sqlite-storage
 */

type SqlParam = string | number | boolean | null;

interface MockTx {
  executeSql: (
    query: string,
    params?: SqlParam[],
    success?: (tx: MockTx, result: unknown) => void,
    error?: (tx: MockTx, err: unknown) => void,
  ) => void;
}

const mockExecuteSql = jest.fn((_query: string, _params?: SqlParam[]) => {
  return Promise.resolve([
    { rows: { length: 0, item: () => null, raw: () => [] } },
  ]);
});

const mockTransaction = jest.fn((callback: (tx: MockTx) => void) => {
  const tx: MockTx = {
    executeSql: (
      _query: string,
      _params?: SqlParam[],
      success?: (tx: MockTx, result: unknown) => void,
      error?: (tx: MockTx, err: unknown) => void,
    ) => {
      try {
        const result = { rows: { length: 0, item: () => null, raw: () => [] } };
        if (success) success(tx, result);
      } catch (e) {
        if (error) error(tx, e);
      }
    },
  };
  callback(tx);
  return Promise.resolve();
});

const mockDatabase = {
  executeSql: mockExecuteSql,
  transaction: mockTransaction,
  close: jest.fn(() => Promise.resolve()),
};

const SQLite = {
  openDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
  deleteDatabase: jest.fn(() => Promise.resolve()),
  enablePromise: jest.fn(),
  DEBUG: jest.fn(),
};

export default SQLite;
