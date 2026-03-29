import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  Kind,
  getNamedType,
  valueFromASTUntyped,
  type FieldNode,
  type GraphQLResolveInfo,
  type SelectionNode,
} from "graphql";

interface Field {
  name: string;
  on: string;
  alias: string;
  arguments: Record<string, unknown>;
  fields: Field[];
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

  const maybeParentType = info.schema.getType(typeName);

  if (
    maybeParentType instanceof GraphQLObjectType ||
    maybeParentType instanceof GraphQLInterfaceType
  ) {
    return maybeParentType;
  }

  throw new Error("Could not resolve parent type of child node.");
}

function getFieldType(
  node: FieldNode,
  parentTypeName: string,
  info: GraphQLResolveInfo,
): string {
  const parentType = getParentType(parentTypeName, info);
  const field = parentType.getFields()[node.name.value];

  if (!field) {
    throw new Error("Failed to find field type.");
  }

  return getNamedType(field.type).name;
}
