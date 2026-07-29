import { Router } from 'express';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  copyWebsiteFromLocale,
  getWebsiteAdminPage,
  getWebsiteMeta,
  getWebsiteStats,
  listWebsiteAdminContent,
  resetWebsiteAdminPage,
  saveWebsiteAdminPage,
} from '../lib/websiteCms.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.WEBSITE));

router.get('/meta', (_req, res) => {
  res.json(getWebsiteMeta());
});

router.get('/stats', async (_req, res) => {
  try {
    res.json(await getWebsiteStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (_req, res) => {
  try {
    const rows = await listWebsiteAdminContent();
    res.json({ items: rows, ...getWebsiteMeta() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/:locale', async (req, res) => {
  try {
    const row = await getWebsiteAdminPage(req.params.slug, req.params.locale);
    res.json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/:slug/:locale', async (req, res) => {
  try {
    const updatedBy = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      : null;
    const row = await saveWebsiteAdminPage(
      req.params.slug,
      req.params.locale,
      req.body?.data ?? req.body,
      updatedBy,
    );
    res.json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:slug/:locale/reset', async (req, res) => {
  try {
    const updatedBy = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      : null;
    const row = await resetWebsiteAdminPage(req.params.slug, req.params.locale, updatedBy);
    res.json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:slug/:locale/copy-from/:fromLocale', async (req, res) => {
  try {
    const updatedBy = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      : null;
    const row = await copyWebsiteFromLocale(
      req.params.slug,
      req.params.fromLocale,
      req.params.locale,
      updatedBy,
    );
    res.json(row);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
