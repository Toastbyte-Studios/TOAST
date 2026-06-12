export interface SQLiteDatabase {
  executeSql(
    sql: string,
    params?: Array<string | number | boolean | null>,
  ): Promise<
    Array<{
      rows: { length: number; item(index: number): Record<string, unknown> };
    }>
  >;
}

export interface SQLiteStatic {
  enablePromise?(enabled: boolean): void;
  openDatabase(params: {
    name: string;
    location?: string;
    createFromLocation?: number | string;
    readOnly?: boolean;
  }): Promise<SQLiteDatabase>;
}
