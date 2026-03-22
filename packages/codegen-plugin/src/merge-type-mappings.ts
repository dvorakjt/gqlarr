export function mergeTypeMappings(customTypes: Record<string, string>) {
  return {
    String: "string",
    Boolean: "boolean",
    Int: "number",
    Float: "number",
    ID: "string",
    ...customTypes,
  };
}
