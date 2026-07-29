import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { saveELibraryFile, loadELibraryFile, deleteELibraryDir } from '../lib/learningFiles.js';

const router = Router();

function canManage(role) {
  return !['STUDENT', 'PARENT'].includes(role);
}

function sanitizeItemForStudent(item) {
  const { storagePath, fileUrl, ...rest } = item;
  return {
    ...rest,
    hasFile: Boolean(storagePath),
    isPdf: item.mimeType === 'application/pdf',
    isImage: item.mimeType?.startsWith('image/'),
  };
}

router.get('/', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    const where = {
      campusId: req.campusId,
      ...(req.user.role === 'STUDENT' ? { isPublished: true } : {}),
    };
    const items = await prisma.eLibraryItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    const result = req.user.role === 'STUDENT'
      ? items.map(sanitizeItemForStudent)
      : items;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/file', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    const item = await prisma.eLibraryItem.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        ...(req.user.role === 'STUDENT' ? { isPublished: true } : {}),
      },
    });
    if (!item?.storagePath) return res.status(404).json({ error: 'File not found' });
    const buffer = loadELibraryFile(item.storagePath);
    if (!buffer) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(item.fileName || 'book').replace(/"/g, '')}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    const where = {
      id: req.params.id,
      campusId: req.campusId,
      ...(req.user.role === 'STUDENT' ? { isPublished: true } : {}),
    };
    const item = await prisma.eLibraryItem.findFirst({ where });
    if (!item) return res.status(404).json({ error: 'Book not found' });
    res.json(req.user.role === 'STUDENT' ? sanitizeItemForStudent(item) : item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot add e-library items' });
    }
    const {
      title, author, category, readingLevel, description, fileUrl, coverEmoji, isPublished,
      fileName, mimeType, contentBase64,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const item = await prisma.eLibraryItem.create({
      data: {
        campusId: req.campusId,
        title,
        author,
        category,
        readingLevel,
        description,
        fileUrl: fileUrl?.trim() || null,
        coverEmoji: coverEmoji || '📖',
        isPublished: isPublished !== false,
      },
    });

    if (contentBase64 && mimeType && fileName) {
      const storagePath = saveELibraryFile(item.id, { fileName, mimeType, contentBase64 });
      const updated = await prisma.eLibraryItem.update({
        where: { id: item.id },
        data: { fileName, mimeType, storagePath },
      });
      return res.status(201).json(updated);
    }

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit e-library items' });
    }
    const existing = await prisma.eLibraryItem.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const {
      title, author, category, readingLevel, description, fileUrl, coverEmoji, isPublished,
      fileName, mimeType, contentBase64,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    let filePatch = {};
    if (contentBase64 && mimeType && fileName) {
      deleteELibraryDir(existing.id);
      const storagePath = saveELibraryFile(existing.id, { fileName, mimeType, contentBase64 });
      filePatch = { fileName, mimeType, storagePath };
    }

    const item = await prisma.eLibraryItem.update({
      where: { id: existing.id },
      data: {
        title,
        author,
        category,
        readingLevel,
        description,
        fileUrl: fileUrl?.trim() || null,
        coverEmoji: coverEmoji || '📖',
        isPublished: isPublished !== false,
        ...filePatch,
      },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authorizePermission(PERMISSIONS.E_LIBRARY), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete e-library items' });
    }
    const existing = await prisma.eLibraryItem.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    deleteELibraryDir(req.params.id);
    await prisma.eLibraryItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
