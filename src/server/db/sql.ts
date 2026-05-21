export type SQLValue = string | number | boolean | null | Date | string[] | number[] | Record<string, unknown> | unknown[];

export type SQLStatement = {
  text: string;
  values: SQLValue[];
};

export type QueryExecutor = {
  execute<T = unknown>(statement: SQLStatement): Promise<T[]>;
};

export function statement(text: string, values: SQLValue[] = []): SQLStatement {
  return { text, values };
}

export function append(base: SQLStatement, sqlText: string, values: SQLValue[] = []): SQLStatement {
  return {
    text: `${base.text}${sqlText}`,
    values: [...base.values, ...values],
  };
}

export function paramIndex(statement: SQLStatement, offset = 1): number {
  return statement.values.length + offset;
}
