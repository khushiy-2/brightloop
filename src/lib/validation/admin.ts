import { z } from "zod";

export const productTypes = ["SERVICE", "SOFTWARE", "ADDON", "PHYSICAL"] as const;
export const taxTypes = ["PERCENT", "FIXED"] as const;
export const billingPeriods = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

const moneyString = z.string().trim().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter an amount with up to 10 whole digits and 2 decimal places.");
const rateString = z.string().trim().regex(/^\d{1,4}(?:\.\d{1,3})?$/, "Enter a rate with up to 4 whole digits and 3 decimal places.");

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  q: z.string().trim().max(100).default(""),
});

export function parsePageQueryParams(input: {
  page?: string | string[];
  q?: string | string[];
}) {
  const parsed = pageQuerySchema.safeParse({
    page: typeof input.page === "string" ? input.page : undefined,
    q: typeof input.q === "string" ? input.q : undefined,
  });
  return parsed.success ? parsed.data : { page: 1, q: "" };
}

export const idSchema = z.string().cuid();

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(productTypes),
  salesPrice: moneyString,
  costPrice: moneyString,
  notes: z.string().trim().max(2000).nullable(),
  defaultTaxId: z.string().cuid().nullable(),
  isActive: z.boolean(),
});

export const variantInputSchema = z.object({
  attribute: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(160),
  extraPrice: moneyString,
});

export const taxInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(taxTypes),
  rate: rateString,
  isActive: z.boolean(),
}).superRefine((value, context) => {
  if (value.type === "PERCENT" && Number(value.rate) > 100) {
    context.addIssue({ code: "custom", path: ["rate"], message: "Percentage tax cannot exceed 100." });
  }
});

export const paymentTermInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  days: z.number().int().min(0).max(2_147_483_647),
});

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: moneyString,
  period: z.enum(billingPeriods),
  minQuantity: z.number().int().min(1).max(2_147_483_647),
  availableFrom: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid start date."),
  availableTo: z.string().nullable(),
  autoClose: z.boolean(),
  closable: z.boolean(),
  pausable: z.boolean(),
  renewable: z.boolean(),
}).superRefine((value, context) => {
  if (value.availableTo && Number.isNaN(Date.parse(value.availableTo))) {
    context.addIssue({ code: "custom", path: ["availableTo"], message: "Enter a valid end date." });
  } else if (value.availableTo && new Date(value.availableTo) <= new Date(value.availableFrom)) {
    context.addIssue({ code: "custom", path: ["availableTo"], message: "End date must be after start date." });
  }
});

export const variantUpdateSchema = variantInputSchema.extend({
  isActive: z.boolean(),
});
