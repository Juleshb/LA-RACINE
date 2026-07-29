import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const school = await prisma.schoolProfile.findFirst({
      include: { bankAccounts: true },
    });
    if (!school) {
      return res.status(404).json({ error: 'School profile not found' });
    }
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { bankAccounts, ...data } = req.body;

    await prisma.schoolProfile.update({ where: { id }, data });

    if (bankAccounts) {
      await prisma.bankAccount.deleteMany({ where: { schoolProfileId: id } });
      await prisma.bankAccount.createMany({
        data: bankAccounts.map((acc) => ({
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          schoolProfileId: id,
        })),
      });
    }

    const updated = await prisma.schoolProfile.findUnique({
      where: { id },
      include: { bankAccounts: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
