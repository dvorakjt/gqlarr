import { z } from "zod";
import { configSchema } from "./config-schema";

export function mergeTypeMappings(config: z.infer<typeof configSchema>) {
  let output = {
    String: "string",
    Boolean: "boolean",
    Int: "number",
    Float: "number",
    ID: "string",
  };

  if (config.scalars) {
    output = {
      ...output,
      ...extractTypeNameMap(config.scalars),
    };
  }

  if (config.mappers) {
    output = {
      ...output,
      ...extractTypeNameMap(config.mappers),
    };
  }

  return output;
}

function extractTypeNameMap(typeOrPathMap: Record<string, string>) {
  const typeNameMap: Record<string, string> = {};

  for (const graphqlType in typeOrPathMap) {
    typeNameMap[graphqlType] = extractTypeName(typeOrPathMap[graphqlType]);
  }

  return typeNameMap;
}

function extractTypeName(typeOrPath: string) {
  if (!typeOrPath.includes("#")) return typeOrPath;

  return typeOrPath.slice(typeOrPath.lastIndexOf("#") + 1);
}
