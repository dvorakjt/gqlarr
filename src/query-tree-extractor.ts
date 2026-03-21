import {
  GraphQLResolveInfo,
  Kind,
  SelectionNode,
  valueFromASTUntyped,
} from "graphql";

interface Field {
  name: string;
  on: string;
  alias: string;
  arguments: Record<string, unknown>;
  fields: Field[];
}

export class QueryTreeExtractor<T extends Field[]> {
  constructor(private info: GraphQLResolveInfo) {}

  extract(): T {
    return this.info.fieldNodes.flatMap((fieldNode) =>
      this.extractTree(fieldNode),
    ) as T;
  }

  private extractTree(node: SelectionNode, typeCondition?: string): Field[] {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = this.info.fragments[node.name.value];
      if (fragment) {
        return fragment.selectionSet.selections.flatMap((selectionNode) =>
          this.extractTree(selectionNode, fragment.typeCondition.name.value),
        );
      } else return [];
    } else if (node.kind === Kind.INLINE_FRAGMENT) {
      return node.selectionSet.selections.flatMap((selectionNode) =>
        this.extractTree(
          selectionNode,
          node.typeCondition?.name.value ?? typeCondition,
        ),
      );
    } else {
      return [
        {
          name: node.name.value,
          alias: node.alias?.value,
          on: typeCondition,
          arguments: Object.fromEntries(
            node.arguments?.map((arg) => [
              arg.name.value,
              valueFromASTUntyped(arg.value, this.info.variableValues),
            ]) ?? [],
          ),
          fields:
            node.selectionSet?.selections.flatMap((selectionNode) =>
              this.extractTree(selectionNode),
            ) ?? [],
        },
      ];
    }
  }
}
