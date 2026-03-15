import {
  PluginFunction,
  PluginValidateFn,
} from "@graphql-codegen/plugin-helpers";
import { input } from "zod";

import fs from "fs";
import path from "path";

import { configSchema } from "./config-schema";
import { mergeTypeMappings } from "./merge-type-mappings";
import { createInputTypeInfoMap } from "./create-input-type-info-map";
import { createOutputTypeInfoMap } from "./create-output-type-info-map";
import { createInputTypeToTSTypeMapper } from "./create-input-type-to-ts-type-mapper";
import { createQueryTreeNodeTypeInfoMap } from "./create-query-tree-node-type-info-map";
import { createTypeDefinitionFileContents } from "./create-type-definition-file-contents";

// The main plugin export
// future, would like to also handle directives somehow
export const plugin: PluginFunction<input<typeof configSchema>> = (
  schema,
  documents,
  config,
  info,
) => {
  const parsedConfig = configSchema.parse(config);

  // for now, because it may be more complex to resolve type names than initially
  // expected, just use default type mappings
  const typeMappings = mergeTypeMappings({});

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
    {},
    inputTypeInfoMap,
    queryTreeNodeTypeInfoMap,
  );

  // add imports
  // add input type definitions
  // add remaining type definitions

  fs.writeFileSync(
    path.join(__dirname, "output.ts"),
    typeDefinitionFileContents,
    "utf-8",
  );

  return typeDefinitionFileContents;
};
