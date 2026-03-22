import fs from "fs";
import ts, {
  EnumDeclaration,
  ImportDeclaration,
  InterfaceDeclaration,
  NodeFlags,
  PropertySignature,
  SyntaxKind,
  TypeAliasDeclaration,
  TypeNode,
} from "typescript";
import synchronizedPrettier from "@prettier/sync";
import type { InputTypeInfoMap } from "./create-input-type-info-map";
import type { QueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";
import { GraphQLNamedType } from "graphql";
import path from "path";

export function createTypeDefinitionFileContents(
  imports: Record<string, string[]>,
  inputTypeInfoMap: InputTypeInfoMap,
  queryTreeNodeTypeInfoMap: QueryTreeNodeTypeInfoMap,
) {
  const statements: string[] = [
    createImportStatements(imports),
    createFlattenType(),
    ...createInputTypeDefinitions(inputTypeInfoMap),
    ...createQueryTreeTypeDefinitions(queryTreeNodeTypeInfoMap),
    createGqlarrObject(queryTreeNodeTypeInfoMap),
    createExtractFunction(),
  ].filter((statement) => !!statement);

  return formatOutput(statements.join("\n"));
}

function createImportStatements(imports: Record<string, string[]>) {
  const importDeclarations: ImportDeclaration[] = [];

  for (const source in imports) {
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports(
          imports[source].map((identifier) => {
            return ts.factory.createImportSpecifier(
              true,
              undefined,
              ts.factory.createIdentifier(identifier),
            );
          }),
        ),
      ),
      ts.factory.createStringLiteral(source, true),
    );

    importDeclarations.push(importDeclaration);
  }

  return print(importDeclarations);
}

function createFlattenType() {
  const declaration = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    "Flatten",
    [
      ts.factory.createTypeParameterDeclaration(
        undefined,
        ts.factory.createIdentifier("T"),
        ts.factory.createArrayTypeNode(
          ts.factory.createArrayTypeNode(
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          ),
        ),
      ),
    ],
    ts.factory.createArrayTypeNode(
      ts.factory.createIndexedAccessTypeNode(
        ts.factory.createIndexedAccessTypeNode(
          ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("T")),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
        ),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      ),
    ),
  );

  return print([declaration]);
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

  return typeDefinitions.map((typeDef) => print([typeDef]));
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

  return typeDeclarations.map((typeDec) => print([typeDec]));
}

function createGqlarrObject(
  queryTreeNodeTypeInfoMap: QueryTreeNodeTypeInfoMap,
) {
  const methods: string[] = [];

  if ("QueryFields" in queryTreeNodeTypeInfoMap) {
    methods.push(
      fs.readFileSync(path.join(__dirname, "get-query-template.txt"), "utf-8"),
    );
  }

  if ("MutationFields" in queryTreeNodeTypeInfoMap) {
    methods.push(
      fs.readFileSync(
        path.join(__dirname, "get-mutation-template.txt"),
        "utf-8",
      ),
    );
  }

  if ("SubscriptionFields" in queryTreeNodeTypeInfoMap) {
    methods.push(
      fs.readFileSync(
        path.join(__dirname, "get-subscription-template.txt"),
        "utf-8",
      ),
    );
  }

  if (!methods.length) return "export const gqlarr = {};";

  return ["export const gqlarr = {", ...methods, "};"].join("\n");
}

function createExtractFunction() {
  return fs.readFileSync(path.join(__dirname, "extract-template.txt"), "utf-8");
}

function print(statements: ts.Statement[]) {
  const printer = ts.createPrinter();

  const sourceFile = ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  return printer.printFile(sourceFile);
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
