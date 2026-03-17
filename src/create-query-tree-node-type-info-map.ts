import { ArgumentInfo, OutputTypeInfo } from "./create-output-type-info-map";

export type QueryTreeNodeTypeInfoMap = Record<string, QueryTreeNodeFieldsType>;

export interface QueryTreeNodeFieldsType {
  fields: QueryTreeNodeInfo[];
  unionWith: string[];
}

export interface QueryTreeNodeInfo {
  name: string;
  on: string;
  arguments: Record<string, QueryTreeNodeArgumentInfo>;
  fieldsTypeName: string | undefined;
}

export interface QueryTreeNodeArgumentInfo {
  tsType: string;
  isArray: boolean;
  isNullable: boolean;
  areElementsNullable: boolean;
}

export type GraphqlToTSMapper = (graphqlInputType: string) => string;

export function createQueryTreeNodeTypeInfoMap(
  outputTypeInfoMap: Record<string, OutputTypeInfo>,
  typeMapper: GraphqlToTSMapper,
): QueryTreeNodeTypeInfoMap {
  const output: Record<string, QueryTreeNodeFieldsType> = {};

  for (const typeName in outputTypeInfoMap) {
    const fieldsTypeName = createFieldsTypeName(typeName);
    const fieldsType = {
      fields: getFields(typeName, typeName, outputTypeInfoMap, typeMapper),
      unionWith: getUnionWith(typeName, outputTypeInfoMap),
    };
    output[fieldsTypeName] = fieldsType;
  }

  return output;
}

function createQueryTreeNodeArgumentInfoMap(
  argumentInfoMap: Record<string, ArgumentInfo>,
  typeMapper: GraphqlToTSMapper,
): Record<string, QueryTreeNodeArgumentInfo> {
  const queryTreeArgumentInfoMap: Record<string, QueryTreeNodeArgumentInfo> =
    {};

  for (const argName in argumentInfoMap) {
    const arg = argumentInfoMap[argName];

    queryTreeArgumentInfoMap[argName] = {
      tsType: typeMapper(arg.type),
      isNullable: arg.isNullable,
      isArray: arg.isArray,
      areElementsNullable: arg.areElementsNullable,
    };
  }

  return queryTreeArgumentInfoMap;
}

function createFieldsTypeName(graphqlTypeName: string) {
  return graphqlTypeName + "Fields";
}

function getFields(
  typeName: string,
  leafTypeName: string,
  outputTypeInfoMap: Record<string, OutputTypeInfo>,
  typeMapper: GraphqlToTSMapper,
) {
  const typeInfo = outputTypeInfoMap[typeName];
  const fields: QueryTreeNodeInfo[] = [];

  for (const fieldName in typeInfo.fields) {
    const field = typeInfo.fields[fieldName];
    let fieldsTypeName: string | undefined = undefined;

    if (field.type in outputTypeInfoMap) {
      fieldsTypeName = createFieldsTypeName(field.type);
    }

    fields.push({
      name: fieldName,
      on: leafTypeName,
      arguments: createQueryTreeNodeArgumentInfoMap(
        field.arguments,
        typeMapper,
      ),
      fieldsTypeName,
    });
  }

  return fields;
}

function getUnionWith(
  typeName: string,
  outputTypeInfoMap: Record<string, OutputTypeInfo>,
): string[] {
  const type = outputTypeInfoMap[typeName];
  if (type.isUnion)
    return type.members.map((member) => createFieldsTypeName(member));

  let unionWith: string[] = [];

  for (const otherTypeName in outputTypeInfoMap) {
    if (otherTypeName === typeName) continue;

    const otherType = outputTypeInfoMap[otherTypeName];

    if (otherType.implements.includes(typeName)) {
      unionWith.push(createFieldsTypeName(otherTypeName));
      unionWith = unionWith.concat(
        getUnionWith(otherTypeName, outputTypeInfoMap),
      );
    }
  }

  return unionWith;
}
