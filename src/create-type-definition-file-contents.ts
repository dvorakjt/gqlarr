import type { GraphQLSchema } from "graphql";
import type { InputTypeInfoMap } from "./create-input-type-info-map";
import type { QueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";
import type { ResolverInfoMap } from "./create-resolver-info-map";

import ts, {
  EnumDeclaration,
  ImportDeclaration,
  InterfaceDeclaration,
  NodeFlags,
  PropertySignature,
  Statement,
  SyntaxKind,
  TypeAliasDeclaration,
  TypeNode,
} from "typescript";
import synchronizedPrettier from "@prettier/sync";
import { z } from "zod";
import { configSchema } from "./config-schema";
import { isImportObject } from "./helpers";

const graphqlResolveInfoIdentifier =
  ts.factory.createIdentifier("GraphQLResolveInfo");

const isNamedFieldNodeIdentifier =
  ts.factory.createIdentifier("isNamedFieldNode");

const extractFieldIdentifier = ts.factory.createIdentifier("extractField");

export function createTypeDefinitionFileContents(
  schema: GraphQLSchema,
  imports: z.infer<typeof configSchema>["imports"],
  inputTypeInfoMap: InputTypeInfoMap,
  queryTreeNodeTypeInfoMap: QueryTreeNodeTypeInfoMap,
  resolverInfoMap: ResolverInfoMap,
) {
  const statements: string[] = [
    createImportStatements(imports),
    ...createInputTypeDefinitions(inputTypeInfoMap),
    ...createQueryTreeTypeDefinitions(queryTreeNodeTypeInfoMap),
    ...createResolverTypeDefinitions(resolverInfoMap),
    createGqlarrObject(schema),
  ].filter((statement) => !!statement);

  return formatOutput(statements.join("\n"));
}

function createImportStatements(
  imports: z.infer<typeof configSchema>["imports"],
) {
  const importDeclarations: ImportDeclaration[] = [];

  for (const source in imports) {
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        Array.isArray(imports[source]) || imports[source].typeOnly,
        undefined,
        ts.factory.createNamedImports(
          (isImportObject(imports[source])
            ? imports[source].imports
            : imports[source]
          ).map((importDefinition) => {
            return ts.factory.createImportSpecifier(
              !Array.isArray(imports[source]) &&
                !imports[source].typeOnly &&
                (typeof importDefinition === "string" ||
                  (typeof importDefinition === "object" &&
                    importDefinition.typeOnly)),
              undefined,
              ts.factory.createIdentifier(
                typeof importDefinition === "object"
                  ? importDefinition.name
                  : importDefinition,
              ),
            );
          }),
        ),
      ),
      ts.factory.createStringLiteral(source, true),
    );

    importDeclarations.push(importDeclaration);
  }

  return toString(importDeclarations);
}

function createInputTypeDefinitions(inputTypeInfoMap: InputTypeInfoMap) {
  const typeDefinitions: Array<
    InterfaceDeclaration | EnumDeclaration | TypeAliasDeclaration
  > = [];

  for (const typeName in inputTypeInfoMap) {
    const typeInfo = inputTypeInfoMap[typeName];

    if ("members" in typeInfo) {
      const enumDeclaration = ts.factory.createEnumDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier(typeName),
        typeInfo.members.map((member) =>
          ts.factory.createEnumMember(
            member,
            ts.factory.createStringLiteral(member),
          ),
        ),
      );

      typeDefinitions.push(enumDeclaration);
    } else if (!typeInfo.isOneOfDirectiveApplied) {
      const members: PropertySignature[] = [];

      for (const fieldName in typeInfo.fields) {
        const fieldInfo = typeInfo.fields[fieldName];

        const propertySignature = ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(fieldName),
          fieldInfo.isNullable
            ? ts.factory.createToken(SyntaxKind.QuestionToken)
            : undefined,
          toTsType(fieldInfo),
        );

        members.push(propertySignature);
      }

      const inputObjectInterfaceDeclaration =
        ts.factory.createInterfaceDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createIdentifier(typeName),
          undefined,
          undefined,
          members,
        );

      typeDefinitions.push(inputObjectInterfaceDeclaration);
    } else {
      const members: TypeNode[] = [];

      for (const fieldName in typeInfo.fields) {
        const fieldInfo = typeInfo.fields[fieldName];
        const properties: PropertySignature[] = [];

        // create the property signature for the field in question
        properties.push(
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier(fieldName),
            fieldInfo.isNullable
              ? ts.factory.createToken(SyntaxKind.QuestionToken)
              : undefined,
            toTsType(fieldInfo),
          ),
        );

        // add optional properities whose value must be never for the rest
        // of the fields
        for (const otherFieldName in typeInfo.fields) {
          if (otherFieldName === fieldName) continue;

          properties.push(
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier(otherFieldName),
              ts.factory.createToken(SyntaxKind.QuestionToken),
              ts.factory.createKeywordTypeNode(SyntaxKind.NeverKeyword),
            ),
          );
        }

        const singleFieldObjectType =
          ts.factory.createTypeLiteralNode(properties);
        members.push(singleFieldObjectType);
      }

      const singleFieldObjectTypeUnion = ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier(typeName),
        undefined,
        ts.factory.createUnionTypeNode(members),
      );

      typeDefinitions.push(singleFieldObjectTypeUnion);
    }
  }

  return typeDefinitions.map((typeDef) => toString(typeDef));
}

function createQueryTreeTypeDefinitions(
  queryTreeNodeTypeInfoMap: QueryTreeNodeTypeInfoMap,
) {
  const typeDeclarations: Array<TypeAliasDeclaration> = [];

  for (const typeName in queryTreeNodeTypeInfoMap) {
    const queryTreeNodeInfo = queryTreeNodeTypeInfoMap[typeName];

    let type: TypeNode = ts.factory.createArrayTypeNode(
      ts.factory.createUnionTypeNode(
        queryTreeNodeInfo.fields.map((fieldInfo) => {
          return ts.factory.createTypeLiteralNode([
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("name"),
              undefined,
              ts.factory.createLiteralTypeNode(
                ts.factory.createStringLiteral(fieldInfo.name),
              ),
            ),
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("on"),
              undefined,
              ts.factory.createLiteralTypeNode(
                ts.factory.createStringLiteral(fieldInfo.on),
              ),
            ),
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("alias"),
              undefined,
              ts.factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
            ),
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("arguments"),
              undefined,
              ts.factory.createTypeLiteralNode(
                Object.entries(fieldInfo.arguments).map(
                  ([argName, argTypeInfo]) => {
                    return ts.factory.createPropertySignature(
                      undefined,
                      ts.factory.createIdentifier(argName),
                      argTypeInfo.isNullable
                        ? ts.factory.createToken(SyntaxKind.QuestionToken)
                        : undefined,
                      toTsType(argTypeInfo),
                    );
                  },
                ),
              ),
            ),
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("fields"),
              undefined,
              fieldInfo.fieldsTypeName
                ? ts.factory.createTypeReferenceNode(fieldInfo.fieldsTypeName)
                : ts.factory.createKeywordTypeNode(SyntaxKind.NeverKeyword),
            ),
          ]);
        }),
      ),
    );

    if (queryTreeNodeInfo.unionWith.length) {
      type = ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("Flatten"),
        [
          ts.factory.createTupleTypeNode([
            type,
            ...queryTreeNodeInfo.unionWith.map((member) =>
              ts.factory.createTypeReferenceNode(member),
            ),
          ]),
        ],
      );
    }

    const typeDeclaration = ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(typeName),
      undefined,
      type,
    );

    typeDeclarations.push(typeDeclaration);
  }

  return typeDeclarations.map((typeDec) => toString(typeDec));
}

function createResolverTypeDefinitions(resolverInfoMap: ResolverInfoMap) {
  const resolverDefinitions: Statement[] = [];
  const resolversObjectMembers: PropertySignature[] = [];

  for (const operationName in resolverInfoMap) {
    const operation = resolverInfoMap[operationName];
    const operationMembers: PropertySignature[] = [];

    for (const fieldName in operation.fields) {
      const field = operation.fields[fieldName];
      let returnType: TypeNode = ts.factory.createTypeReferenceNode(
        field.tsType,
      );

      if (field.isArray) {
        if (field.areElementsNullable) {
          returnType = ts.factory.createUnionTypeNode([
            returnType,
            ts.factory.createLiteralTypeNode(ts.factory.createNull()),
          ]);
        }

        returnType = ts.factory.createArrayTypeNode(returnType);
      }

      if (field.isNullable) {
        returnType = ts.factory.createUnionTypeNode([
          returnType,
          ts.factory.createLiteralTypeNode(ts.factory.createNull()),
        ]);
      }

      const resolverIdentifier = ts.factory.createIdentifier(
        operationName +
          capitalize(fieldName) +
          (operation.isSubscription ? "SubscriptionHandler" : "Resolver"),
      );

      const contextTypeParameterIdentifier =
        ts.factory.createIdentifier("TContext");

      if (operation.isSubscription) {
        const payloadTypeParameterIdentifier =
          ts.factory.createIdentifier("TPayload");

        resolverDefinitions.push(
          ts.factory.createInterfaceDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            resolverIdentifier,
            [
              ts.factory.createTypeParameterDeclaration(
                undefined,
                contextTypeParameterIdentifier,
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              ),
              ts.factory.createTypeParameterDeclaration(
                undefined,
                payloadTypeParameterIdentifier,
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              ),
            ],
            undefined,
            [
              ts.factory.createPropertySignature(
                undefined,
                "subscribe",
                undefined,
                ts.factory.createFunctionTypeNode(
                  undefined,
                  [
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("_parent"),
                      undefined,
                      ts.factory.createKeywordTypeNode(
                        ts.SyntaxKind.UnknownKeyword,
                      ),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("_args"),
                      undefined,
                      ts.factory.createTypeReferenceNode("Record", [
                        ts.factory.createKeywordTypeNode(
                          ts.SyntaxKind.StringKeyword,
                        ),
                        ts.factory.createKeywordTypeNode(
                          ts.SyntaxKind.UnknownKeyword,
                        ),
                      ]),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("context"),
                      undefined,
                      ts.factory.createTypeReferenceNode(
                        contextTypeParameterIdentifier,
                      ),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("info"),
                      undefined,
                      ts.factory.createTypeReferenceNode("GraphQLResolveInfo"),
                    ),
                  ],
                  ts.factory.createTypeReferenceNode("AsyncIterable", [
                    ts.factory.createTypeReferenceNode(
                      payloadTypeParameterIdentifier,
                    ),
                  ]),
                ),
              ),
              ts.factory.createPropertySignature(
                undefined,
                "resolve",
                undefined,
                ts.factory.createFunctionTypeNode(
                  undefined,
                  [
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("payload"),
                      undefined,
                      ts.factory.createTypeReferenceNode(
                        payloadTypeParameterIdentifier,
                      ),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("_args"),
                      undefined,
                      ts.factory.createTypeReferenceNode("Record", [
                        ts.factory.createKeywordTypeNode(
                          ts.SyntaxKind.StringKeyword,
                        ),
                        ts.factory.createKeywordTypeNode(
                          ts.SyntaxKind.UnknownKeyword,
                        ),
                      ]),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("context"),
                      undefined,
                      ts.factory.createTypeReferenceNode(
                        contextTypeParameterIdentifier,
                      ),
                    ),
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier("info"),
                      undefined,
                      ts.factory.createTypeReferenceNode("GraphQLResolveInfo"),
                    ),
                  ],
                  ts.factory.createUnionTypeNode([
                    returnType,
                    ts.factory.createTypeReferenceNode("Promise", [returnType]),
                  ]),
                ),
              ),
            ],
          ),
        );
      } else {
        resolverDefinitions.push(
          ts.factory.createTypeAliasDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            resolverIdentifier,
            [
              ts.factory.createTypeParameterDeclaration(
                undefined,
                contextTypeParameterIdentifier,
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              ),
            ],
            ts.factory.createFunctionTypeNode(
              undefined,
              [
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  ts.factory.createIdentifier("_parent"),
                  undefined,
                  ts.factory.createKeywordTypeNode(
                    ts.SyntaxKind.UnknownKeyword,
                  ),
                ),
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  ts.factory.createIdentifier("_args"),
                  undefined,
                  ts.factory.createTypeReferenceNode("Record", [
                    ts.factory.createKeywordTypeNode(
                      ts.SyntaxKind.StringKeyword,
                    ),
                    ts.factory.createKeywordTypeNode(
                      ts.SyntaxKind.UnknownKeyword,
                    ),
                  ]),
                ),
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  ts.factory.createIdentifier("context"),
                  undefined,
                  ts.factory.createTypeReferenceNode(
                    contextTypeParameterIdentifier,
                  ),
                ),
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  ts.factory.createIdentifier("info"),
                  undefined,
                  ts.factory.createTypeReferenceNode("GraphQLResolveInfo"),
                ),
              ],
              ts.factory.createUnionTypeNode([
                returnType,
                ts.factory.createTypeReferenceNode("Promise", [returnType]),
              ]),
            ),
          ),
        );
      }

      const fieldSignature = ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(fieldName),
        undefined,
        ts.factory.createTypeReferenceNode(resolverIdentifier),
      );

      operationMembers.push(fieldSignature);
    }

    const operationSignature = ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(operationName),
      undefined,
      ts.factory.createTypeLiteralNode(operationMembers),
    );

    resolversObjectMembers.push(operationSignature);
  }

  const resolversInterfaceDeclaration = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    resolversObjectMembers,
  );

  return [
    ...resolverDefinitions.map((r) => toString(r)),
    toString(resolversInterfaceDeclaration),
  ];
}

function createGqlarrObject(schema: GraphQLSchema) {
  const properties: ts.PropertyAssignment[] = [];

  if (schema.getQueryType()) {
    properties.push(
      createGetFieldFunction("Query", schema.getQueryType().name),
    );
  }

  if (schema.getMutationType()) {
    properties.push(
      createGetFieldFunction("Mutation", schema.getMutationType().name),
    );
  }

  if (schema.getSubscriptionType()) {
    properties.push(
      createGetFieldFunction("Subscription", schema.getSubscriptionType().name),
    );
  }

  const gqlarrExport = ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          "gqlarr",
          undefined,
          undefined,
          ts.factory.createObjectLiteralExpression(properties),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  return toString(gqlarrExport);
}

function createGetFieldFunction(
  operationType: "Query" | "Mutation" | "Subscription",
  operationName: string,
) {
  const infoObjectIdentifier = ts.factory.createIdentifier("info");
  const generatedFieldsTypeIdentifier = ts.factory.createIdentifier(
    operationName + "Fields",
  );

  const operationTypeIdentifier = ts.factory.createIdentifier(
    operationType.toLowerCase() + "Type",
  );

  const typeAccessorIdentifier = ts.factory.createIdentifier(
    "get" + operationType + "Type",
  );

  const fieldNameParameterIdentifier = ts.factory.createIdentifier("fieldName");

  const returnType = ts.factory.createTypeReferenceNode("Extract", [
    ts.factory.createIndexedAccessTypeNode(
      ts.factory.createTypeReferenceNode(generatedFieldsTypeIdentifier),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
    ),
    ts.factory.createTypeLiteralNode([
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("name"),
        undefined,
        ts.factory.createTypeReferenceNode("T"),
      ),
    ]),
  ]);

  const getOperationTypeStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          operationTypeIdentifier,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                infoObjectIdentifier,
                ts.factory.createIdentifier("schema"),
              ),
              typeAccessorIdentifier,
            ),
            undefined,
            undefined,
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const nodeIdentifier = ts.factory.createIdentifier("node");

  const findNodeStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          nodeIdentifier,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                infoObjectIdentifier,
                ts.factory.createIdentifier("fieldNodes"),
              ),
              ts.factory.createIdentifier("find"),
            ),
            undefined,
            [
              ts.factory.createArrowFunction(
                undefined,
                undefined,
                [
                  ts.factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    ts.factory.createIdentifier("node"),
                    undefined,
                    undefined,
                    undefined,
                  ),
                ],
                undefined,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                ts.factory.createCallExpression(
                  isNamedFieldNodeIdentifier,
                  undefined,
                  [nodeIdentifier, fieldNameParameterIdentifier],
                ),
              ),
            ],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const maybeEarlyReturnStatement = ts.factory.createIfStatement(
    ts.factory.createLogicalOr(
      ts.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        operationTypeIdentifier,
      ),
      ts.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        nodeIdentifier,
      ),
    ),
    ts.factory.createBlock([
      ts.factory.createReturnStatement(
        ts.factory.createIdentifier("undefined"),
      ),
    ]),
  );

  const returnStatement = ts.factory.createReturnStatement(
    ts.factory.createAsExpression(
      ts.factory.createCallExpression(extractFieldIdentifier, undefined, [
        nodeIdentifier,
        ts.factory.createPropertyAccessExpression(
          operationTypeIdentifier,
          ts.factory.createIdentifier("name"),
        ),
        infoObjectIdentifier,
      ]),
      returnType,
    ),
  );

  const body = ts.factory.createBlock([
    getOperationTypeStatement,
    findNodeStatement,
    maybeEarlyReturnStatement,
    returnStatement,
  ]);

  const gqlarrObjectPropertyName = "get" + capitalize(operationName) + "Field";

  const declaration = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(gqlarrObjectPropertyName),
    ts.factory.createArrowFunction(
      undefined,
      [
        ts.factory.createTypeParameterDeclaration(
          undefined,
          ts.factory.createIdentifier("T"),
          ts.factory.createIndexedAccessTypeNode(
            ts.factory.createIndexedAccessTypeNode(
              ts.factory.createTypeReferenceNode(generatedFieldsTypeIdentifier),
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
            ),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral("name"),
            ),
          ),
        ),
      ],
      [
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          "info",
          undefined,
          ts.factory.createTypeReferenceNode(graphqlResolveInfoIdentifier),
        ),
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          fieldNameParameterIdentifier,
          undefined,
          ts.factory.createTypeReferenceNode("T"),
        ),
      ],
      ts.factory.createUnionTypeNode([
        returnType,
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]),
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body,
    ),
  );

  return declaration;
}

function toTsType(typeInfo: {
  tsType: string;
  isArray: boolean;
  areElementsNullable: boolean;
}) {
  let type: TypeNode = ts.factory.createTypeReferenceNode(typeInfo.tsType);

  if (typeInfo.isArray) {
    if (typeInfo.areElementsNullable) {
      type = ts.factory.createUnionTypeNode([
        type,
        ts.factory.createLiteralTypeNode(ts.factory.createNull()),
      ]);
    }

    type = ts.factory.createArrayTypeNode(type);
  }

  return type;
}

function toString(statementOrStatements: ts.Statement | ts.Statement[]) {
  const printer = ts.createPrinter();

  if (!Array.isArray(statementOrStatements)) {
    statementOrStatements = [statementOrStatements];
  }

  const sourceFile = ts.factory.createSourceFile(
    statementOrStatements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  return printer.printFile(sourceFile);
}

function formatOutput(output: string) {
  return synchronizedPrettier
    .format(output, {
      parser: "typescript",
      printWidth: 80,
      tsDoc: true,
      jsdocPreferCodeFences: true,
    })
    .trim();
}

function capitalize(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}
