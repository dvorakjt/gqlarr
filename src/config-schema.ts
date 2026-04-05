import z from "zod";

export const configSchema = z.object({
  types: z
    .record(z.string(), z.string())
    .optional()
    .default(() => ({})),
  imports: z
    .record(
      z.string(),
      z
        .string()
        .array()
        .or(
          z.object({
            imports: z.array(
              z.string().or(
                z.object({
                  name: z.string(),
                  typeOnly: z.boolean(),
                }),
              ),
            ),
            typeOnly: z.boolean(),
          }),
        ),
    )
    .default(() => ({})),
});
