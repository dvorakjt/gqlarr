import { PluginFunction } from "@graphql-codegen/plugin-helpers";
import { input } from "zod";

import { configSchema } from "./config-schema";
import { mergeTypeMappings } from "./merge-type-mappings";
import { createInputTypeInfoMap } from "./create-input-type-info-map";
import { createOutputTypeInfoMap } from "./create-output-type-info-map";
import { createInputTypeToTSTypeMapper } from "./create-input-type-to-ts-type-mapper";
import { createQueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";
import { createTypeDefinitionFileContents } from "./create-type-definition-file-contents";

export const plugin: PluginFunction<input<typeof configSchema>> = (
  schema,
  _documents,
  config,
  _info,
) => {
  const parsedConfig = configSchema.parse(config);
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

  const typeDefinitionFileContents = createTypeDefinitionFileContents(
    schema,
    parsedConfig.imports,
    inputTypeInfoMap,
    queryTreeNodeTypeInfoMap,
  );

  return typeDefinitionFileContents;
};
