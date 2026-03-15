import {
  Kind,
  type NamedTypeNode,
  type GraphQLNamedType,
  type TypeNode,
  InputValueDefinitionNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from "graphql";

export type OutputTypeInfo = {
  isInterface: boolean;
  implements: string[];
  isUnion: boolean;
  members: string[];
  fields: Record<string, FieldInfo>;
};

export interface FieldInfo {
  type: string;
  arguments: Record<string, ArgumentInfo>;
}

export interface ArgumentInfo {
  type: string;
  isArray: boolean;
  isNullable: boolean;
  areElementsNullable: boolean;
}

export function createOutputTypeInfoMap(
  typeMap: Record<string, GraphQLNamedType>,
): Record<string, OutputTypeInfo> {
  const outputTypeInfoMap: Record<string, OutputTypeInfo> = {};

  for (const key in typeMap) {
    const type = typeMap[key];

    if (
      !type.astNode ||
      (type.astNode.kind !== Kind.OBJECT_TYPE_DEFINITION &&
        type.astNode.kind !== Kind.INTERFACE_TYPE_DEFINITION &&
        type.astNode.kind !== Kind.UNION_TYPE_DEFINITION)
    ) {
      continue;
    }

    outputTypeInfoMap[type.name] = getTypeInfo(type.astNode);
  }

  return outputTypeInfoMap;
}

function getTypeInfo(
  type:
    | ObjectTypeDefinitionNode
    | InterfaceTypeDefinitionNode
    | UnionTypeDefinitionNode,
) {
  return {
    isInterface: type.kind == Kind.INTERFACE_TYPE_DEFINITION,
    implements:
      (type.kind == Kind.OBJECT_TYPE_DEFINITION &&
        type.interfaces?.map((iface) => iface.name.value)) ||
      [],
    isUnion: type.kind == Kind.UNION_TYPE_DEFINITION,
    members:
      (type.kind == Kind.UNION_TYPE_DEFINITION &&
        type.types?.map((type) => type.name.value)) ||
      [],
    fields:
      "fields" in type && type.fields ? createFieldInfoMap(type.fields) : {},
  };
}

function createFieldInfoMap(
  fields: readonly FieldDefinitionNode[],
): Record<string, FieldInfo> {
  return fields
    .map((field) => getFieldInfo(field))
    .reduce((fieldInfoMap, fieldInfo) => {
      return {
        ...fieldInfoMap,
        [fieldInfo.name]: {
          type: fieldInfo.type,
          arguments: fieldInfo.arguments,
        },
      };
    }, {});
}

function getFieldInfo(
  field: FieldDefinitionNode,
): { name: string } & FieldInfo {
  return {
    name: field.name.value,
    type: getBaseType(field.type),
    arguments: field.arguments ? createArgumentInfoMap(field.arguments) : {},
  };
}

function createArgumentInfoMap(
  args: readonly InputValueDefinitionNode[],
): Record<string, ArgumentInfo> {
  return args
    .map((arg) => getArgumentInfo(arg))
    .reduce((argInfoMap, argInfo) => {
      return {
        ...argInfoMap,
        [argInfo.name]: {
          type: argInfo.type,
          isNullable: argInfo.isNullable,
          isArray: argInfo.isArray,
          areElementsNullable: argInfo.areElementsNullable,
        },
      };
    }, {});
}

function getArgumentInfo(
  arg: InputValueDefinitionNode,
): { name: string } & ArgumentInfo {
  let type = arg.type;
  let isNullable = true;
  let isArray = false;
  let areElementsNullable = true;

  if (type.kind == Kind.NON_NULL_TYPE) {
    isNullable = false;
    type = type.type;
  }

  if (type.kind == Kind.LIST_TYPE) {
    isArray = true;
    type = type.type;

    if (type.kind == Kind.NON_NULL_TYPE) {
      areElementsNullable = false;
      type = type.type;
    }
  }

  return {
    name: arg.name.value,
    type: (type as NamedTypeNode).name.value,
    isNullable,
    isArray,
    areElementsNullable,
  };
}

function getBaseType(type: TypeNode): string {
  while (type.kind == Kind.NON_NULL_TYPE || type.kind == Kind.LIST_TYPE) {
    type = type.type;
  }

  return type.name.value;
}

// get the output types
// get the operation types
// map it all to objects
// use these objects to create type definitions
