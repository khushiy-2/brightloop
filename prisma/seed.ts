import { Prisma, Role, TaxType } from "@prisma/client";
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
    await prisma.tax.update({ where: { id: existing.id }, data });
  } else {
    await prisma.tax.create({ data: { name, ...data } });
  }
}

async function main() {
  await seedUser({ name: "Brightloop Admin", email: "admin@brightloop.com", password: "Admin@12345!", role: Role.ADMIN });
  await seedUser({ name: "Brightloop Staff", email: "staff@brightloop.com", password: "Staff@12345!", role: Role.STAFF });
  await seedUser({ name: "Brightloop Customer", email: "customer@brightloop.com", password: "Customer@12345!", role: Role.CUSTOMER });

  for (const [name, days] of [["Immediate", 0], ["Net 15", 15], ["Net 30", 30]] as const) {
    await prisma.paymentTerm.upsert({ where: { name }, create: { name, days }, update: { days } });
  }

  await seedTax("GST 18%", "18");
  await seedTax("GST 5%", "5");
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());