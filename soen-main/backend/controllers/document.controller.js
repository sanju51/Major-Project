import * as documentService from '../services/document.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.resolve('backend/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const documentData = {
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      project: req.body.projectId,
      task: req.body.taskId,
      uploadedBy: req.user._id,
    };

    const document = await documentService.uploadDocument(documentData);
    res.status(201).json({ document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDocumentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const documents = await documentService.getDocumentsByProject(projectId);
    res.status(200).json({ documents });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDocumentsByTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const documents = await documentService.getDocumentsByTask(taskId);
    res.status(200).json({ documents });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await documentService.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json({ document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await documentService.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.download(document.path, document.originalName);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    await documentService.deleteDocument(documentId);
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const uploadNewVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { documentId } = req.params;

    const newDocumentData = {
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
    };

    const document = await documentService.uploadNewVersion(documentId, newDocumentData, req.user._id);
    res.status(200).json({ document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const approveDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await documentService.approveDocument(documentId, req.user._id);
    res.status(200).json({ document });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export { upload };
