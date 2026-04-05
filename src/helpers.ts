import assert from "assert";

import {
  type FieldNode,
  type GraphQLResolveInfo,
  type SelectionNode,
  GraphQLInterfaceType,
  GraphQLObjectType,
  Kind,
  getNamedType,
  valueFromASTUntyped,
} from "graphql";

import type { Field } from "./types";

export function isImportObject(
  value:
    | string[]
    | {
        imports: (string | { name: string; typeOnly: boolean })[];
        typeOnly: boolean;
      },
): value is {
  imports: (string | { name: string; typeOnly: boolean })[];
  typeOnly: boolean;
} {
  return !Array.isArray(value);
}

export function isNamedFieldNode(
  node: SelectionNode,
  name: string,
): node is FieldNode {
  return node.kind === Kind.FIELD && node.name.value === name;
}

export function extractField(
  node: FieldNode,
  on: string,
  info: GraphQLResolveInfo,
): Field {
  return {
    name: node.name.value,
    alias: node.alias?.value ?? node.name.value,
    on,
    arguments: Object.fromEntries(
      node.arguments?.map((arg) => [
        arg.name.value,
        valueFromASTUntyped(arg.value, info.variableValues),
      ]) ?? [],
    ),
    fields:
      node.selectionSet?.selections.flatMap((selectionNode) =>
        extractFields(selectionNode, getFieldType(node, on, info), info),
      ) ?? [],
  };
}

function extractFields(
  node: SelectionNode,
  on: string,
  info: GraphQLResolveInfo,
): Field[] {
  if (node.kind === Kind.FRAGMENT_SPREAD) {
    const fragment = info.fragments[node.name.value];
    if (fragment) {
      return fragment.selectionSet.selections.flatMap((selectionNode) =>
        extractFields(selectionNode, fragment.typeCondition.name.value, info),
      );
    } else return [];
  } else if (node.kind === Kind.INLINE_FRAGMENT) {
    return node.selectionSet.selections.flatMap((selectionNode) =>
      extractFields(selectionNode, node.typeCondition?.name.value ?? on, info),
    );
  } else {
    return [extractField(node, on, info)];
  }
}

function getParentType(typeName: string, info: GraphQLResolveInfo) {
  const queryType = info.schema.getQueryType();
  const mutationType = info.schema.getMutationType();
  const subscriptionType = info.schema.getSubscriptionType();

  if (queryType && typeName === queryType.name) {
    return queryType;
  }

  if (mutationType && typeName === mutationType.name) {
    return mutationType;
  }

  if (subscriptionType && typeName === subscriptionType.name) {
    return subscriptionType;
  }

  const parentType = info.schema.getType(typeName);

  /* 
    The parent type should always be an object or interface. 
  */
  assert(
    parentType instanceof GraphQLObjectType ||
      parentType instanceof GraphQLInterfaceType,
  );

  return parentType;
}

function getFieldType(
  node: FieldNode,
  parentTypeName: string,
  info: GraphQLResolveInfo,
): string {
  const parentType = getParentType(parentTypeName, info);
  const field = parentType.getFields()[node.name.value];

  // The field should always exist.
  assert(!!field);

  return getNamedType(field.type).name;
}
