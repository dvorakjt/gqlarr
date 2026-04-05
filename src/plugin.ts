import { PluginFunction } from "@graphql-codegen/plugin-helpers";
import { input } from "zod";

import { configSchema } from "./config-schema";
import { createInputTypeInfoMap } from "./create-input-type-info-map";
import { createOutputTypeInfoMap } from "./create-output-type-info-map";
import { createInputTypeToTSTypeMapper } from "./create-input-type-to-ts-type-mapper";
import { createQueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";
import { createTypeDefinitionFileContents } from "./create-type-definition-file-contents";
import { mergeTypeMappings } from "./merge-type-mappings";
import { mergeImports } from "./merge-imports";
import { createResolverInfoMap } from "./create-resolver-info-map";

export type GQLARRConfig = input<typeof configSchema>;

export const plugin: PluginFunction<GQLARRConfig> = (
  schema,
  _documents,
  config,
  _info,
) => {
  const parsedConfig = configSchema.parse(config);
  const imports = mergeImports(parsedConfig.imports);
  const typeMappings = mergeTypeMappings(parsedConfig.types);

  const inputTypeInfoMap = createInputTypeInfoMap(
    schema.getTypeMap(),
    typeMappings,
  );

  const outputTypeInfoMap = createOutputTypeInfoMap(schema.getTypeMap());

  const inputTypeToTSTypeMapper = createInputTypeToTSTypeMapper(
    schema.getTypeMap(),
    typeMappings,
  );

  const queryTreeNodeTypeInfoMap = createQueryTreeNodeTypeInfoMap(
    outputTypeInfoMap,
    inputTypeToTSTypeMapper,
  );

  const resolverInfoMap = createResolverInfoMap(schema, typeMappings);

  const typeDefinitionFileContents = createTypeDefinitionFileContents(
    schema,
    imports,
    inputTypeInfoMap,
    queryTreeNodeTypeInfoMap,
    resolverInfoMap,
  );

  return typeDefinitionFileContents;
};
