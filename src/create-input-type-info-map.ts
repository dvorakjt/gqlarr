import {
  Kind,
  type NamedTypeNode,
  type GraphQLNamedType,
  type InputObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  GraphQLInputObjectType,
} from "graphql";

export type InputTypeInfoMap = Record<string, InputObjectInfo | EnumInfo>;

export interface InputObjectInfo {
  fields: InputObjectFieldInfoMap;
  isOneOfDirectiveApplied: boolean;
}

export type InputObjectFieldInfoMap = Record<string, InputObjectFieldInfo>;

export interface InputObjectFieldInfo {
  tsType: string;
  isNullable: boolean;
  isArray: boolean;
  areElementsNullable: boolean;
}

export interface EnumInfo {
  members: string[];
}

export function createInputTypeInfoMap(
  typeMap: Record<string, GraphQLNamedType>,
  typeMappings: Record<string, string>,
): InputTypeInfoMap {
  const output: InputTypeInfoMap = {};

  for (const typeName in typeMap) {
    const type = typeMap[typeName];

    if (
      typeName in typeMappings ||
      !type.astNode ||
      (type.astNode.kind !== Kind.ENUM_TYPE_DEFINITION &&
        type.astNode.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION)
    )
      continue;

    if (type.astNode.kind === Kind.ENUM_TYPE_DEFINITION) {
      output[typeName] = {
        members: type.astNode.values?.map((value) => value.name.value) ?? [],
      };
    } else {
      const inputObjectInfo = {
        fields: createInputObjectFieldInfoMap(
          type.astNode,
          typeMappings,
          typeMap,
        ),
        isOneOfDirectiveApplied: !!(
          type.astNode.directives &&
          type.astNode.directives.find(
            (directive) => directive.name.value === "oneOf",
          )
        ),
      };

      output[typeName] = inputObjectInfo;
    }
  }

  return output;
}

function createInputObjectFieldInfoMap(
  type: InputObjectTypeDefinitionNode,
  typeMappings: Record<string, string>,
  typeMap: Record<string, GraphQLNamedType>,
): Record<string, InputObjectFieldInfo> {
  if (!type.fields) return {};

  return type.fields
    .map((field) => getInputObjectFieldInfo(field, typeMappings, typeMap))
    .reduce((inputObjectFieldInfoMap, fieldInfo) => {
      return {
        ...inputObjectFieldInfoMap,
        [fieldInfo.name]: {
          tsType: fieldInfo.tsType,
          isNullable: fieldInfo.isNullable,
          isArray: fieldInfo.isArray,
          areElementsNullable: fieldInfo.areElementsNullable,
        },
      };
    }, {});
}

function getInputObjectFieldInfo(
  field: InputValueDefinitionNode,
  typeMappings: Record<string, string>,
  typeMap: Record<string, GraphQLNamedType>,
): { name: string } & InputObjectFieldInfo {
  let graphqlType = field.type;
  let isNullable = true;
  let isArray = false;
  let areElementsNullable = true;

  if (graphqlType.kind == Kind.NON_NULL_TYPE) {
    isNullable = false;
    graphqlType = graphqlType.type;
  }

  if (graphqlType.kind == Kind.LIST_TYPE) {
    isArray = true;
    graphqlType = graphqlType.type;

    if (graphqlType.kind == Kind.NON_NULL_TYPE) {
      areElementsNullable = false;
      graphqlType = graphqlType.type;
    }
  }

  const graphqlTypeName = (graphqlType as NamedTypeNode).name.value;

  const tsType =
    graphqlTypeName in typeMappings
      ? typeMappings[graphqlTypeName]
      : isInputObjectType(graphqlTypeName, typeMap)
        ? graphqlTypeName
        : "any";

  return {
    name: field.name.value,
    tsType,
    isNullable,
    isArray,
    areElementsNullable,
  };
}

function isInputObjectType(
  typeName: string,
  typeMap: Record<string, GraphQLNamedType>,
) {
  return typeMap[typeName] instanceof GraphQLInputObjectType;
}
