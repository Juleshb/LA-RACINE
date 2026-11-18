import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();
router.use(authorizePermission(PERMISSIONS.INVENTORY));

const OPERATORS = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'INVENTORY_MANAGER']);
const APPROVERS = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'HEAD_OF_STUDIES']);

function canOperate(user) {
  return OPERATORS.has(user.role);
}

function canApprove(user) {
  return APPROVERS.has(user.role);
}

function actorName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Staff';
}

function fail(status, error) {
  const err = new Error(error);
  err.status = status;
  throw err;
}

function money(value) {
  return Number(value || 0);
}

function articleJson(row) {
  return {
    ...row,
    price: money(row.price),
    categoryName: row.category?.name || '',
    storeName: row.store?.name || '',
    supplierName: row.supplier?.name || '',
  };
}

async function nextRef(countQuery, prefix) {
  const count = await countQuery;
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

/** Next code for this campus and year, for example BC-2026-020. Uses the highest number already saved, not the row count. */
export async function nextDocumentRef(findRefs, prefix) {
  const head = `${prefix}-${new Date().getFullYear()}-`;
  const rows = await findRefs(head);
  let max = 0;
  for (const row of rows) {
    const sequence = Number(String(row.ref || '').slice(head.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return `${head}${String(max + 1).padStart(3, '0')}`;
}

async function saveWithRef(findRefs, prefix, create) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = await nextDocumentRef(findRefs, prefix);
    try {
      return await create(ref);
    } catch (error) {
      if (error?.code !== 'P2002' || attempt === 4) throw error;
    }
  }
  return null;
}

async function applyDelta(tx, { articleId, delta, type, ref, reason, notes, actorName: name }) {
  const article = await tx.stockArticle.findUnique({ where: { id: articleId } });
  if (!article || !article.isActive) fail(404, 'Article not found');
  const next = article.qty + delta;
  if (next < 0) fail(400, 'Insufficient stock. The operation was refused.');
  await tx.stockArticle.update({ where: { id: articleId }, data: { qty: next } });
  await tx.stockMovement.create({
    data: {
      campusId: article.campusId,
      storeId: article.storeId,
      articleId,
      type,
      qty: delta,
      ref: ref || null,
      reason: reason || null,
      notes: notes || null,
      actorName: name,
    },
  });
  return next;
}

router.get('/', async (req, res) => {
  try {
    const campusId = req.campusId;
    const operate = canOperate(req.user);
    const approve = canApprove(req.user);
    const requestWhere = operate || approve
      ? { campusId }
      : { campusId, requesterId: req.user.id };
    const [categories, stores, suppliers, articles, purchases, movements, requests, transfers, assets] = await Promise.all([
      prisma.stockCategory.findMany({ where: { campusId }, orderBy: { name: 'asc' } }),
      prisma.stockStore.findMany({ where: { campusId }, orderBy: { name: 'asc' } }),
      operate ? prisma.stockSupplier.findMany({ where: { campusId }, orderBy: { name: 'asc' } }) : [],
      prisma.stockArticle.findMany({
        where: { campusId },
        include: {
          category: { select: { name: true } },
          store: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      operate ? prisma.stockPurchase.findMany({
        where: { campusId },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }) : [],
      operate ? prisma.stockMovement.findMany({
        where: { campusId },
        include: { article: { select: { name: true } }, store: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }) : [],
      prisma.stockRequest.findMany({ where: requestWhere, orderBy: { createdAt: 'desc' }, take: 200 }),
      operate ? prisma.stockTransfer.findMany({
        where: { OR: [{ sourceCampusId: campusId }, { destCampusId: campusId }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }) : [],
      operate ? prisma.stockAsset.findMany({ where: { campusId }, orderBy: { createdAt: 'desc' } }) : [],
    ]);
    const visibleArticles = articles.filter((item) => operate || item.isActive).map(articleJson);
    const units = visibleArticles.reduce((sum, item) => sum + item.qty, 0);
    const value = visibleArticles.reduce((sum, item) => sum + item.qty * item.price, 0);
    const low = visibleArticles.filter((item) => item.qty <= item.minQty);
    res.json({
      canOperate: operate,
      canApprove: approve,
      categories,
      stores,
      suppliers,
      articles: operate ? visibleArticles : visibleArticles.map(({ price, ...item }) => ({ ...item, price: null })),
      purchases: purchases.map((item) => ({
        ...item,
        unitPrice: money(item.unitPrice),
        fees: money(item.fees),
        total: money(item.total),
        supplierName: item.supplier?.name || '',
      })),
      movements: movements.map((item) => ({
        ...item,
        articleName: item.article?.name || '',
        storeName: item.store?.name || '',
      })),
      requests,
      transfers,
      assets: assets.map((item) => ({ ...item, price: money(item.price) })),
      summary: {
        articles: visibleArticles.length,
        units,
        value: operate ? value : null,
        low: low.length,
        out: low.filter((item) => item.qty === 0).length,
        pendingRequests: requests.filter((item) => item.status === 'PENDING').length,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/stores', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can look up stores');
    const campusId = req.query.campusId || req.campusId;
    const campus = await prisma.campus.findFirst({ where: { id: campusId, isActive: true } });
    if (!campus) fail(404, 'Campus not found');
    const stores = await prisma.stockStore.findMany({
      where: { campusId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    res.json(stores);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can create a category');
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    if (!code || !name) fail(400, 'Code and name are required');
    const row = await prisma.stockCategory.create({ data: { campusId: req.campusId, code, name } });
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/stores', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can create a store');
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase()
      || await nextRef(prisma.stockStore.count({ where: { campusId: req.campusId } }), 'MAG');
    if (!name) fail(400, 'Store name is required');
    const row = await prisma.stockStore.create({
      data: {
        campusId: req.campusId,
        code,
        name,
        manager: String(req.body.manager || '').trim() || null,
        location: String(req.body.location || '').trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/suppliers', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can add a supplier');
    const name = String(req.body.name || '').trim();
    if (!name) fail(400, 'Supplier name is required');
    const row = await prisma.stockSupplier.create({
      data: {
        campusId: req.campusId,
        name,
        phone: String(req.body.phone || '').trim() || null,
        email: String(req.body.email || '').trim() || null,
        address: String(req.body.address || '').trim() || null,
        contact: String(req.body.contact || '').trim() || null,
        taxNumber: String(req.body.taxNumber || '').trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/articles', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can add an article');
    const name = String(req.body.name || '').trim();
    const storeId = req.body.storeId;
    if (!name || !storeId) fail(400, 'Name and store are required');
    const store = await prisma.stockStore.findFirst({ where: { id: storeId, campusId: req.campusId } });
    if (!store) fail(404, 'Store not found on this campus');
    const code = String(req.body.code || '').trim().toUpperCase()
      || await nextRef(prisma.stockArticle.count({ where: { campusId: req.campusId } }), 'ART');
    const row = await prisma.stockArticle.create({
      data: {
        campusId: req.campusId,
        storeId,
        categoryId: req.body.categoryId || null,
        supplierId: req.body.supplierId || null,
        code,
        name,
        type: req.body.type || 'Consumable',
        unit: req.body.unit || 'Piece',
        price: Number(req.body.price) || 0,
        minQty: Math.max(0, Number(req.body.minQty) || 0),
        description: String(req.body.description || '').trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/articles/:id', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can edit an article');
    const existing = await prisma.stockArticle.findFirst({ where: { id: req.params.id, campusId: req.campusId } });
    if (!existing) fail(404, 'Article not found');
    const row = await prisma.stockArticle.update({
      where: { id: existing.id },
      data: {
        name: String(req.body.name || existing.name).trim(),
        price: req.body.price == null ? undefined : Number(req.body.price) || 0,
        minQty: req.body.minQty == null ? undefined : Math.max(0, Number(req.body.minQty) || 0),
        isActive: req.body.isActive == null ? undefined : Boolean(req.body.isActive),
        type: req.body.type || undefined,
        unit: req.body.unit || undefined,
      },
    });
    res.json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/movements', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can move stock');
    const type = req.body.type === 'EXIT' ? 'EXIT' : 'ENTRY';
    const qty = Math.floor(Number(req.body.qty));
    if (!req.body.articleId || !Number.isFinite(qty) || qty <= 0) fail(400, 'Choose an article and a quantity');
    const article = await prisma.stockArticle.findFirst({ where: { id: req.body.articleId, campusId: req.campusId } });
    if (!article) fail(404, 'Article not found on this campus');
    const ref = await nextDocumentRef(
      (head) => prisma.stockMovement.findMany({
        where: { campusId: req.campusId, ref: { startsWith: head } },
        select: { ref: true },
      }),
      type === 'ENTRY' ? 'IN' : 'OUT',
    );
    await prisma.$transaction((tx) => applyDelta(tx, {
      articleId: article.id,
      delta: type === 'ENTRY' ? qty : -qty,
      type,
      ref,
      reason: req.body.reason,
      notes: req.body.notes,
      actorName: actorName(req.user),
    }));
    res.status(201).json({ saved: true, ref });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/purchases', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can create a purchase order');
    const qty = Math.floor(Number(req.body.qty));
    const unitPrice = Number(req.body.unitPrice) || 0;
    const fees = Number(req.body.fees) || 0;
    if (!req.body.supplierId || !req.body.articleId || !Number.isFinite(qty) || qty <= 0) {
      fail(400, 'Supplier, article, and quantity are required');
    }
    const [supplier, article] = await Promise.all([
      prisma.stockSupplier.findFirst({ where: { id: req.body.supplierId, campusId: req.campusId } }),
      prisma.stockArticle.findFirst({ where: { id: req.body.articleId, campusId: req.campusId } }),
    ]);
    if (!supplier || !article) fail(404, 'Supplier or article not found on this campus');
    const row = await saveWithRef(
      (head) => prisma.stockPurchase.findMany({
        where: { campusId: req.campusId, ref: { startsWith: head } },
        select: { ref: true },
      }),
      'BC',
      (ref) => prisma.stockPurchase.create({
        data: {
          campusId: req.campusId,
          supplierId: supplier.id,
          articleId: article.id,
          articleName: article.name,
          ref,
          qty,
          unitPrice,
          fees,
          total: qty * unitPrice + fees,
          status: 'PENDING',
        },
      }),
    );
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/purchases/:id/receive', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can receive a purchase');
    const purchase = await prisma.stockPurchase.findFirst({ where: { id: req.params.id, campusId: req.campusId } });
    if (!purchase) fail(404, 'Purchase not found');
    if (purchase.status === 'RECEIVED') fail(400, 'This purchase was already received');
    const articleId = req.body.articleId || purchase.articleId;
    const storeId = req.body.storeId;
    const qty = Math.floor(Number(req.body.qty || purchase.qty));
    if (!articleId || !Number.isFinite(qty) || qty <= 0) fail(400, 'Choose the received article and quantity');
    const article = await prisma.stockArticle.findFirst({ where: { id: articleId, campusId: req.campusId } });
    if (!article) fail(404, 'Article not found');
    if (storeId && article.storeId !== storeId) fail(400, 'Receive the article into its own store, or move it with a transfer');
    await prisma.$transaction(async (tx) => {
      await applyDelta(tx, {
        articleId: article.id,
        delta: qty,
        type: 'ENTRY',
        ref: purchase.ref,
        reason: 'Purchase',
        actorName: actorName(req.user),
      });
      await tx.stockPurchase.update({ where: { id: purchase.id }, data: { status: 'RECEIVED' } });
    });
    res.json({ saved: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/requests', async (req, res) => {
  try {
    const qty = Math.floor(Number(req.body.qty));
    const article = req.body.articleId
      ? await prisma.stockArticle.findFirst({ where: { id: req.body.articleId, campusId: req.campusId, isActive: true } })
      : null;
    const articleName = article?.name || String(req.body.articleName || '').trim();
    if (!articleName || !Number.isFinite(qty) || qty <= 0) fail(400, 'Article and quantity are required');
    const row = await saveWithRef(
      (head) => prisma.stockRequest.findMany({
        where: { campusId: req.campusId, ref: { startsWith: head } },
        select: { ref: true },
      }),
      'DEM',
      (ref) => prisma.stockRequest.create({
        data: {
          campusId: req.campusId,
          requesterId: req.user.id,
          ref,
          personName: actorName(req.user),
          service: req.body.service || 'Teaching',
          articleId: article?.id || null,
          articleName,
          qty,
          priority: req.body.priority || 'Normal',
          reason: String(req.body.reason || '').trim() || null,
          status: 'PENDING',
        },
      }),
    );
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/requests/:id/decision', async (req, res) => {
  try {
    if (!canApprove(req.user)) fail(403, 'The head of studies or a school manager approves requests');
    const row = await prisma.stockRequest.findFirst({ where: { id: req.params.id, campusId: req.campusId } });
    if (!row) fail(404, 'Request not found');
    if (!['PENDING', 'CHANGES'].includes(row.status)) fail(400, 'This request is no longer waiting for a decision');
    const decision = req.body.decision;
    if (decision === 'REJECTED' && !String(req.body.reason || '').trim()) {
      fail(400, 'A reason is required to reject a request');
    }
    const approvedQty = decision === 'APPROVED'
      ? Math.max(0, Math.floor(Number(req.body.approvedQty ?? row.qty)))
      : 0;
    const status = decision === 'APPROVED' ? 'APPROVED' : decision === 'CHANGES' ? 'CHANGES' : 'REJECTED';
    const updated = await prisma.stockRequest.update({
      where: { id: row.id },
      data: {
        status,
        approvedQty: status === 'APPROVED' ? (approvedQty || row.qty) : row.approvedQty,
        reason: String(req.body.reason || row.reason || '').trim() || row.reason,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/requests/:id/serve', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can distribute items');
    const row = await prisma.stockRequest.findFirst({ where: { id: req.params.id, campusId: req.campusId } });
    if (!row) fail(404, 'Request not found');
    if (!['APPROVED', 'PARTIAL'].includes(row.status)) fail(400, 'Approve the request before distributing it');
    const article = row.articleId
      ? await prisma.stockArticle.findFirst({ where: { id: row.articleId, campusId: req.campusId } })
      : await prisma.stockArticle.findFirst({ where: { campusId: req.campusId, name: row.articleName, isActive: true } });
    if (!article) fail(400, 'This article is not in the campus stock');
    const remaining = (row.approvedQty || row.qty) - row.servedQty;
    const qty = Math.floor(Number(req.body.qty));
    if (!Number.isFinite(qty) || qty <= 0 || qty > remaining || qty > article.qty) {
      fail(400, 'Quantity is above the approved amount or the available stock');
    }
    const served = row.servedQty + qty;
    const status = served >= (row.approvedQty || row.qty) ? 'SERVED' : 'PARTIAL';
    await prisma.$transaction(async (tx) => {
      await applyDelta(tx, {
        articleId: article.id,
        delta: -qty,
        type: 'EXIT',
        ref: row.ref,
        reason: 'Distribution',
        actorName: actorName(req.user),
      });
      await tx.stockRequest.update({ where: { id: row.id }, data: { servedQty: served, status } });
    });
    res.json({ saved: true, status });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/requests/:id/confirm', async (req, res) => {
  try {
    const row = await prisma.stockRequest.findFirst({ where: { id: req.params.id, campusId: req.campusId } });
    if (!row) fail(404, 'Request not found');
    if (row.requesterId !== req.user.id && !canOperate(req.user)) fail(403, 'Only the requester can confirm receipt');
    if (row.status !== 'SERVED') fail(400, 'Confirm receipt after the items have been distributed');
    const updated = await prisma.stockRequest.update({ where: { id: row.id }, data: { status: 'CONFIRMED' } });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/transfers', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can transfer stock');
    const qty = Math.floor(Number(req.body.qty));
    const { articleId, sourceStoreId, destStoreId, destCampusId } = req.body;
    if (!articleId || !sourceStoreId || !destStoreId || !Number.isFinite(qty) || qty <= 0) {
      fail(400, 'Source, destination, article, and quantity are required');
    }
    if (sourceStoreId === destStoreId) fail(400, 'Choose a different destination store');
    const targetCampusId = destCampusId || req.campusId;
    if (targetCampusId !== req.campusId && req.body.authorized !== true) {
      fail(400, 'An inter-campus transfer needs authorization');
    }
    const [article, source, dest, targetCampus] = await Promise.all([
      prisma.stockArticle.findFirst({ where: { id: articleId, campusId: req.campusId, storeId: sourceStoreId } }),
      prisma.stockStore.findFirst({ where: { id: sourceStoreId, campusId: req.campusId } }),
      prisma.stockStore.findFirst({ where: { id: destStoreId, campusId: targetCampusId } }),
      prisma.campus.findFirst({ where: { id: targetCampusId, isActive: true } }),
    ]);
    if (!article || !source || !dest || !targetCampus) fail(404, 'Store or article not found');
    if (article.qty < qty) fail(400, 'Insufficient stock in the source store');
    const row = await saveWithRef(
      (head) => prisma.stockTransfer.findMany({
        where: { ref: { startsWith: head } },
        select: { ref: true },
      }),
      'TRF',
      (ref) => prisma.stockTransfer.create({
        data: {
          ref,
          sourceCampusId: req.campusId,
          destCampusId: targetCampus.id,
          sourceStoreId: source.id,
          destStoreId: dest.id,
          articleId: article.id,
          articleName: article.name,
          qty,
          reason: String(req.body.reason || '').trim() || null,
          status: 'SUBMITTED',
          actorName: actorName(req.user),
        },
      }),
    );
    res.status(201).json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/transfers/:id/receive', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can receive a transfer');
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: req.params.id,
        OR: [{ sourceCampusId: req.campusId }, { destCampusId: req.campusId }],
      },
    });
    if (!transfer) fail(404, 'Transfer not found');
    if (transfer.status === 'RECEIVED') fail(400, 'This transfer was already received');
    if (req.campusId !== transfer.destCampusId) {
      fail(403, 'Open the destination campus to confirm this transfer');
    }
    await prisma.$transaction(async (tx) => {
      const source = await tx.stockArticle.findUnique({ where: { id: transfer.articleId } });
      if (!source || source.qty < transfer.qty) fail(400, 'Source stock is no longer sufficient');
      await applyDelta(tx, {
        articleId: source.id,
        delta: -transfer.qty,
        type: 'TRANSFER',
        ref: transfer.ref,
        reason: 'Transfer out',
        actorName: actorName(req.user),
      });
      let dest = await tx.stockArticle.findFirst({
        where: {
          campusId: transfer.destCampusId,
          storeId: transfer.destStoreId,
          name: source.name,
          isActive: true,
        },
      });
      if (!dest) {
        const code = `${source.code}-${transfer.ref}`;
        dest = await tx.stockArticle.create({
          data: {
            campusId: transfer.destCampusId,
            storeId: transfer.destStoreId,
            categoryId: transfer.destCampusId === source.campusId ? source.categoryId : null,
            code,
            name: source.name,
            type: source.type,
            unit: source.unit,
            price: source.price,
            minQty: source.minQty,
            qty: 0,
          },
        });
      }
      await applyDelta(tx, {
        articleId: dest.id,
        delta: transfer.qty,
        type: 'TRANSFER',
        ref: transfer.ref,
        reason: 'Transfer in',
        actorName: actorName(req.user),
      });
      await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: 'RECEIVED' } });
    });
    res.json({ saved: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/counts', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can validate an inventory count');
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const changes = [];
    for (const line of lines) {
      const counted = Math.floor(Number(line.counted));
      if (!line.articleId || !Number.isFinite(counted) || counted < 0) continue;
      const article = await prisma.stockArticle.findFirst({ where: { id: line.articleId, campusId: req.campusId } });
      if (!article || article.qty === counted) continue;
      changes.push({ article, counted, note: line.note || '' });
    }
    if (!changes.length) fail(400, 'No difference to record');
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await applyDelta(tx, {
          articleId: change.article.id,
          delta: change.counted - change.article.qty,
          type: 'ADJUSTMENT',
          ref: `INV-${new Date().toISOString().slice(0, 10)}`,
          reason: 'Physical inventory',
          notes: change.note,
          actorName: actorName(req.user),
        });
      }
    });
    res.json({ saved: true, adjustments: changes.length });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/assets', async (req, res) => {
  try {
    if (!canOperate(req.user)) fail(403, 'Only the stock desk can register equipment');
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase()
      || await nextRef(prisma.stockAsset.count({ where: { campusId: req.campusId } }), 'EQ');
    if (!name) fail(400, 'Equipment name is required');
    const row = await prisma.stockAsset.create({
      data: {
        campusId: req.campusId,
        code,
        name,
        serial: String(req.body.serial || '').trim() || null,
        location: String(req.body.location || '').trim() || null,
        owner: String(req.body.owner || '').trim() || null,
        acquiredAt: req.body.acquiredAt ? new Date(req.body.acquiredAt) : null,
        price: Number(req.body.price) || 0,
        state: req.body.state || 'New',
      },
    });
    res.status(201).json({ ...row, price: money(row.price) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
