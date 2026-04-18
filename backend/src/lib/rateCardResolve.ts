import { prisma } from './prisma';

export async function resolveRateCard(input: {
  organizationId: string;
  clientId: string;
  at: Date;
  explicitRateCardId?: string;
  contractRef?: string;
}) {
  const baseWhere = {
    organizationId: input.organizationId,
    active: true,
    OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: input.at } }],
    AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.at } }] }],
  };

  if (input.explicitRateCardId) {
    return prisma.rateCard.findFirst({
      where: { ...baseWhere, id: input.explicitRateCardId },
    });
  }

  const clientCard = await prisma.rateCard.findFirst({
    where: { ...baseWhere, clientId: input.clientId },
    orderBy: { createdAt: 'desc' },
  });
  if (clientCard) return clientCard;

  if (input.contractRef) {
    const contractCard = await prisma.rateCard.findFirst({
      where: { ...baseWhere, contractRef: input.contractRef },
      orderBy: { createdAt: 'desc' },
    });
    if (contractCard) return contractCard;
  }

  return prisma.rateCard.findFirst({
    where: { ...baseWhere, clientId: null },
    orderBy: { createdAt: 'desc' },
  });
}
