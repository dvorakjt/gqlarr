export type Flatten<T extends any[][]> = T[number][number][];

export interface Field {
  name: string;
  on: string;
  alias: string;
  arguments: Record<string, unknown>;
  fields: Field[];
}
