import { z } from "zod";

export const createRequestSchema = z.object({
  subdomain: z
    .string()
    .min(1, "Subdomain is required")
    .transform((s) => s.toLowerCase().trim())
    .refine((s) => /^[a-z0-9-]+$/.test(s), "Subdomain must be lowercase letters, numbers, and hyphens only"),
  companyName: z.string().optional(),
  companyWebsite: z.string().url("Company website must be a valid URL"),
  competitorWebsites: z
    .array(z.string().url("Competitor website must be a valid URL"))
    .max(3)
    .optional(),
  clientRequirements: z.string().min(1, "Client requirements are required"),
});

export type CreateRequest = z.infer<typeof createRequestSchema>;

