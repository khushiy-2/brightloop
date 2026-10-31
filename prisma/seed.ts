import { BillingPeriod, Prisma, ProductType, Role, TaxType } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { prisma } from "../src/server/db";

async function seedUser(input: { name: string; email: string; password: string; role: Role }) {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: { name: input.name, email: input.email, passwordHash, role: input.role },
    update: { name: input.name, passwordHash, role: input.role, isActive: true },
  });

  if (input.role === Role.CUSTOMER) {
    await prisma.customer.upsert({
      where: { userId: user.id },
      create: { userId: user.id, name: input.name, email: input.email },
      update: { name: input.name, email: input.email },
    });
  }
}

async function seedTax(name: string, rate: string) {
  const existing = await prisma.tax.findFirst({ where: { name } });
  const data = { type: TaxType.PERCENT, rate: new Prisma.Decimal(rate), isActive: true };
  if (existing) {
    return prisma.tax.update({ where: { id: existing.id }, data });
  }
  return prisma.tax.create({ data: { name, ...data } });
}

async function seedProduct(input: {
  name: string;
  type: ProductType;
  salesPrice: string;
  costPrice: string;
  notes: string;
  defaultTaxId: string;
  variants: { attribute: string; value: string; extraPrice: string }[];
}) {
  const existing = await prisma.product.findFirst({ where: { name: input.name } });
  const data = {
    type: input.type,
    salesPrice: new Prisma.Decimal(input.salesPrice),
    costPrice: new Prisma.Decimal(input.costPrice),
    notes: input.notes,
    defaultTaxId: input.defaultTaxId,
    isActive: true,
  };
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data: { name: input.name, ...data } });

  for (const variant of input.variants) {
    await prisma.productVariant.upsert({
      where: { productId_attribute_value: { productId: product.id, attribute: variant.attribute, value: variant.value } },
      create: {
        productId: product.id,
        attribute: variant.attribute,
        value: variant.value,
        extraPrice: new Prisma.Decimal(variant.extraPrice),
        isActive: true,
      },
      update: { extraPrice: new Prisma.Decimal(variant.extraPrice), isActive: true },
    });
  }
}

async function seedPlan(input: {
  name: string;
  price: string;
  period: BillingPeriod;
  minQuantity: number;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
}) {
  const existing = await prisma.plan.findFirst({ where: { name: input.name } });
  const data = {
    price: new Prisma.Decimal(input.price),
    period: input.period,
    minQuantity: input.minQuantity,
    availableFrom: new Date(),
    availableTo: null,
    autoClose: input.autoClose,
    closable: input.closable,
    pausable: input.pausable,
    renewable: input.renewable,
    isActive: true,
  };
  if (existing) {
    await prisma.plan.update({ where: { id: existing.id }, data });
  } else {
    await prisma.plan.create({ data: { name: input.name, ...data } });
  }
}

async function main() {
  await seedUser({ name: "Brightloop Admin", email: "admin@brightloop.com", password: "Admin@12345!", role: Role.ADMIN });
  await seedUser({ name: "Brightloop Staff", email: "staff@brightloop.com", password: "Staff@12345!", role: Role.STAFF });
  await seedUser({ name: "Brightloop Customer", email: "customer@brightloop.com", password: "Customer@12345!", role: Role.CUSTOMER });

  for (const [name, days] of [["Immediate", 0], ["Net 15", 15], ["Net 30", 30]] as const) {
    await prisma.paymentTerm.upsert({ where: { name }, create: { name, days }, update: { days } });
  }

  const gst18 = await seedTax("GST 18%", "18");
  const gst5 = await seedTax("GST 5%", "5");

  await seedProduct({
    name: "Odoo Implementation",
    type: ProductType.SERVICE,
    salesPrice: "1500.00",
    costPrice: "700.00",
    notes: "Guided setup and implementation service.",
    defaultTaxId: gst18.id,
    variants: [
      { attribute: "Brand", value: "Odoo", extraPrice: "560.00" },
      { attribute: "Support", value: "Standard", extraPrice: "0.00" },
    ],
  });
  await seedProduct({
    name: "Brightloop Subscription",
    type: ProductType.SOFTWARE,
    salesPrice: "99.00",
    costPrice: "25.00",
    notes: "Core subscription software license.",
    defaultTaxId: gst18.id,
    variants: [
      { attribute: "License", value: "Team", extraPrice: "25.00" },
      { attribute: "License", value: "Business", extraPrice: "75.00" },
    ],
  });
  await seedProduct({
    name: "Data Migration",
    type: ProductType.ADDON,
    salesPrice: "450.00",
    costPrice: "180.00",
    notes: "One-time assisted data migration add-on.",
    defaultTaxId: gst18.id,
    variants: [{ attribute: "Volume", value: "Large", extraPrice: "200.00" }],
  });
  await seedProduct({
    name: "Priority Support",
    type: ProductType.SERVICE,
    salesPrice: "250.00",
    costPrice: "90.00",
    notes: "Priority response support package.",
    defaultTaxId: gst5.id,
    variants: [{ attribute: "Coverage", value: "24x7", extraPrice: "120.00" }],
  });
  await seedProduct({
    name: "Setup Kit",
    type: ProductType.PHYSICAL,
    salesPrice: "89.00",
    costPrice: "42.00",
    notes: "Physical onboarding and setup kit.",
    defaultTaxId: gst5.id,
    variants: [{ attribute: "Package", value: "Extended", extraPrice: "30.00" }],
  });

  await seedPlan({
    name: "Starter Daily",
    price: "4.99",
    period: BillingPeriod.DAILY,
    minQuantity: 1,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
  });
  await seedPlan({
    name: "Growth Monthly",
    price: "49.00",
    period: BillingPeriod.MONTHLY,
    minQuantity: 3,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
  });
  await seedPlan({
    name: "Annual Enterprise",
    price: "499.00",
    period: BillingPeriod.YEARLY,
    minQuantity: 10,
    autoClose: true,
    closable: false,
    pausable: false,
    renewable: true,
  });
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());