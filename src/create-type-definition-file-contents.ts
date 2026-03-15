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
import type { InputTypeInfoMap } from "./create-input-type-info-map";
import type { QueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";

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
  ];

  return statements.join("\n\n");
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
    undefined,
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
  const typeDefinitions: Array<InterfaceDeclaration | EnumDeclaration> = [];

  for (const typeName in inputTypeInfoMap) {
    const typeInfo = inputTypeInfoMap[typeName];

    if ("members" in typeInfo) {
      const enumDeclaration = ts.factory.createEnumDeclaration(
        undefined,
        ts.factory.createIdentifier(typeName),
        typeInfo.members.map((member) =>
          ts.factory.createEnumMember(
            member,
            ts.factory.createStringLiteral(member),
          ),
        ),
      );

      typeDefinitions.push(enumDeclaration);
    } else {
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
          undefined,
          ts.factory.createIdentifier(typeName),
          undefined,
          undefined,
          members,
        );

      typeDefinitions.push(inputObjectInterfaceDeclaration);
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
      undefined,
      ts.factory.createIdentifier(typeName),
      undefined,
      type,
    );

    typeDeclarations.push(typeDeclaration);
  }

  return typeDeclarations.map((typeDec) => print([typeDec]));
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
