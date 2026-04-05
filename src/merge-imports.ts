import { z } from "zod";
import { configSchema } from "./config-schema";

export function mergeImports(
  customImports: z.infer<typeof configSchema>["imports"],
): z.infer<typeof configSchema>["imports"] {
  return {
    graphql: {
      imports: ["GraphQLResolveInfo"],
      typeOnly: true,
    },
    gqlarr: {
      imports: [
        {
          name: "Flatten",
          typeOnly: true,
        },
        {
          name: "isNamedFieldNode",
          typeOnly: false,
        },
        {
          name: "extractField",
          typeOnly: false,
        },
      ],
      typeOnly: false,
    },
    ...customImports,
  };
}
