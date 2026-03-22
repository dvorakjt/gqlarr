import z from "zod";

export const configSchema = z.object({
  types: z.record(z.string(), z.string()).optional().default({}),
  imports: z.record(z.string(), z.string().array()).optional().default({}),
});
