import {
  GraphQLResolveInfo,
  Kind,
  SelectionNode,
  valueFromASTUntyped,
} from "graphql";

export interface Field {
  name: string;
  on: string;
  alias: string;
  arguments: Record<string, unknown>;
  fields: Field[];
}

export function extract<T extends Field[]>(info: GraphQLResolveInfo) {
  return info.fieldNodes.flatMap((fieldNode) =>
    extractTree(fieldNode, "Root", info),
  ) as T;
}

function extractTree(
  node: SelectionNode,
  typeCondition: string,
  info: GraphQLResolveInfo,
): Field[] {
  if (node.kind === Kind.FRAGMENT_SPREAD) {
    const fragment = info.fragments[node.name.value];
    if (fragment) {
      return fragment.selectionSet.selections.flatMap((selectionNode) =>
        extractTree(selectionNode, fragment.typeCondition.name.value, info),
      );
    } else return [];
  } else if (node.kind === Kind.INLINE_FRAGMENT) {
    return node.selectionSet.selections.flatMap((selectionNode) =>
      extractTree(
        selectionNode,
        node.typeCondition?.name.value ?? typeCondition,
        info,
      ),
    );
  } else {
    return [
      {
        name: node.name.value,
        alias: node.alias?.value ?? node.name.value,
        on: typeCondition,
        arguments: Object.fromEntries(
          node.arguments?.map((arg) => [
            arg.name.value,
            valueFromASTUntyped(arg.value, info.variableValues),
          ]) ?? [],
        ),
        fields:
          node.selectionSet?.selections.flatMap((selectionNode) =>
            extractTree(selectionNode, node.name.value, info),
          ) ?? [],
      },
    ];
  }
}
