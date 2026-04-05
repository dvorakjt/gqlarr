import {
  GraphQLObjectType,
  type GraphQLSchema,
  Kind,
  NamedTypeNode,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";

export type ResolverInfoMap = Record<
  string,
  {
    fields: Record<
      string,
      {
        tsType: string;
        isNullable: boolean;
        isArray: boolean;
        areElementsNullable: boolean;
      }
    >;
    isSubscription: boolean;
  }
>;

export function createResolverInfoMap(
  schema: GraphQLSchema,
  typeMappings: Record<string, string>,
) {
  const resolverInfoMap: ResolverInfoMap = {};

  const queryInfo = getOperationInfo(
    schema.getQueryType(),
    schema,
    typeMappings,
  );

  if (queryInfo) {
    resolverInfoMap[queryInfo.name] = {
      fields: queryInfo.fields,
      isSubscription: false,
    };
  }

  const mutationInfo = getOperationInfo(
    schema.getMutationType(),
    schema,
    typeMappings,
  );

  if (mutationInfo) {
    resolverInfoMap[mutationInfo.name] = {
      fields: mutationInfo.fields,
      isSubscription: false,
    };
  }

  const subscriptionInfo = getOperationInfo(
    schema.getSubscriptionType(),
    schema,
    typeMappings,
  );

  if (subscriptionInfo) {
    resolverInfoMap[subscriptionInfo.name] = {
      fields: subscriptionInfo.fields,
      isSubscription: true,
    };
  }

  return resolverInfoMap;
}

function getOperationInfo(
  operationType: Maybe<GraphQLObjectType>,
  schema: GraphQLSchema,
  typeMappings: Record<string, string>,
) {
  if (!operationType?.astNode?.fields) return undefined;

  const fields = Object.fromEntries(
    operationType.astNode.fields.map((f) => {
      let type = f.type;
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

      let tsType = "any";
      const typeNode = schema.getType((type as NamedTypeNode).name.value);

      if (
        typeNode?.astNode?.kind === Kind.OBJECT_TYPE_DEFINITION ||
        typeNode?.astNode?.kind === Kind.INTERFACE_TYPE_DEFINITION
      ) {
        tsType = "object";
      } else if (typeNode.name in typeMappings) {
        tsType = typeMappings[typeNode.name];
      } else if (typeNode.astNode.kind === Kind.ENUM_TYPE_DEFINITION) {
        tsType = typeNode.name;
      }

      return [
        f.name.value,
        { tsType, isNullable, isArray, areElementsNullable },
      ];
    }),
  );

  return {
    name: operationType.name,
    fields,
  };
}
