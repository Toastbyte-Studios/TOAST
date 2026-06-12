/**
 * Minimal type declarations for react-native-sqlite-storage
 * Covers only the API surface used by SqliteMbtilesWriter.
 */

declare module 'react-native-sqlite-storage' {
  interface ResultSetRowList {
    length: number;
    item(index: number): Record<string, unknown>;
  }

  interface ResultSet {
    rows: ResultSetRowList;
    rowsAffected: number;
    insertId?: number;
  }

  interface Transaction {
    executeSql(sql: string, params?: (string | number | null)[]): void;
  }

  interface SQLiteDatabase {
    executeSql(
      sql: string,
      params?: (string | number | null)[],
    ): Promise<[ResultSet]>;

    transaction(
      callback: (tx: Transaction) => void,
      errorCallback: (error: Error) => void,
      successCallback: () => void,
    ): void;

    close(): Promise<void>;
  }

  interface OpenDatabaseParams {
    name: string;
    location?: string;
    createFromLocation?: number | string;
    readOnly?: boolean;
  }

  /** Static API of the react-native-sqlite-storage module. */
  interface SQLiteStatic {
    enablePromise?(enabled: boolean): void;
    openDatabase(params: OpenDatabaseParams): Promise<SQLiteDatabase>;
  }

  export type { SQLiteDatabase, SQLiteStatic, Transaction, ResultSet };

  const SQLite: SQLiteStatic;

  export default SQLite;
}
