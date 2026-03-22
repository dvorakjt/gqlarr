import { Kind, type GraphQLNamedType } from "graphql";

export function createInputTypeToTSTypeMapper(
  typeMap: Record<string, GraphQLNamedType>,
  typeMappings: Record<string, string>,
) {
  return (inputType: string) => {
    // Known scalars, custom object-type mappings, etc.
    if (inputType in typeMappings) return typeMappings[inputType];

    // Unknown scalar, return any
    if (typeMap[inputType].astNode.kind === Kind.SCALAR_TYPE_DEFINITION)
      return "any";

    return inputType;
  };
}
