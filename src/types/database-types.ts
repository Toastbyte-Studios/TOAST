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
