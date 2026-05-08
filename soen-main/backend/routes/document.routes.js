import express from 'express';
import {
  uploadDocument,
  getDocumentsByProject,
  getDocumentsByTask,
  getDocumentById,
  downloadDocument,
  deleteDocument,
  uploadNewVersion,
  approveDocument,
  upload,
} from '../controllers/document.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyJWT);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/project/:projectId', getDocumentsByProject);
router.get('/task/:taskId', getDocumentsByTask);
router.get('/:documentId', getDocumentById);
router.get('/:documentId/download', downloadDocument);
router.delete('/:documentId', deleteDocument);
router.post('/:documentId/version', upload.single('file'), uploadNewVersion);
router.put('/:documentId/approve', approveDocument);

export default router;
