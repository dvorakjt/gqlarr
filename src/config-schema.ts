import z from "zod";

export const configSchema = z.object({
  scalars: z.record(z.string(), z.string()).optional(),
  mappers: z.record(z.string(), z.string()).optional(),
});
