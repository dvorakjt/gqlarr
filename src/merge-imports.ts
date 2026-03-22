export function mergeImports(imports: Record<string, string[]>) {
  const baseImports: Record<string, string[]> = {
    graphql: [
      "GraphQLResolveInfo",
      "SelectionNode",
      "Kind",
      "valueFromASTUntyped",
    ],
  };

  // Simple algorithm, does not account for prefixing of imports with 'type' keyword
  return Object.entries(imports).reduce((merged, [source, imports]) => {
    if (Object.hasOwn(merged, source)) {
      const combinedImports = new Set<string>([...merged[source], ...imports]);
      merged[source] = Array.from(combinedImports);
      return merged;
    }

    merged[source] = imports;
    return merged;
  }, baseImports);
}
