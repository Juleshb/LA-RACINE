import { Router } from 'express';
import { authorizeRoles, isManagerRole } from '../config/permissions.js';
import { getSecuritySettings, updateSecuritySettings } from '../lib/appSettings.js';

const router = Router();

router.get('/security', async (req, res) => {
  try {
    if (!isManagerRole(req.user.role) && req.user.role !== 'SECRETARY') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(await getSecuritySettings());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/security', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { otpEnabled } = req.body || {};
    if (typeof otpEnabled !== 'boolean') {
      return res.status(400).json({ error: 'otpEnabled (boolean) is required' });
    }
    const settings = await updateSecuritySettings({ otpEnabled }, req.user.id);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
