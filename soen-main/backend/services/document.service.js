import Document from '../models/document.model.js';
import fs from 'fs';
import path from 'path';

export const uploadDocument = async (documentData) => {
  const document = new Document(documentData);
  await document.save();
  return document.populate('uploadedBy project task approvedBy');
};

export const getDocumentsByProject = async (projectId) => {
  return await Document.find({ project: projectId }).populate('uploadedBy project task approvedBy');
};

export const getDocumentsByTask = async (taskId) => {
  return await Document.find({ task: taskId }).populate('uploadedBy project task approvedBy');
};

export const getDocumentById = async (documentId) => {
  return await Document.findById(documentId).populate('uploadedBy project task approvedBy');
};

export const updateDocument = async (documentId, updateData) => {
  return await Document.findByIdAndUpdate(documentId, updateData, { new: true }).populate('uploadedBy project task approvedBy');
};

export const deleteDocument = async (documentId) => {
  const document = await Document.findById(documentId);
  if (document) {
    // Delete file from filesystem
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }
    // Delete old versions
    document.versions.forEach((version) => {
      if (fs.existsSync(version.path)) {
        fs.unlinkSync(version.path);
      }
    });
  }
  return await Document.findByIdAndDelete(documentId);
};

export const uploadNewVersion = async (documentId, newDocumentData, userId) => {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error('Document not found');
  }

  // Add current version to versions array
  document.versions.push({
    version: document.version,
    path: document.path,
    size: document.size,
    uploadedBy: document.uploadedBy,
    uploadedAt: document.updatedAt,
  });

  // Update document with new version
  document.name = newDocumentData.name;
  document.originalName = newDocumentData.originalName;
  document.path = newDocumentData.path;
  document.size = newDocumentData.size;
  document.mimeType = newDocumentData.mimeType;
  document.version = document.version + 1;
  document.uploadedBy = userId;

  await document.save();
  return document.populate('uploadedBy project task approvedBy');
};

export const approveDocument = async (documentId, approverId) => {
  return await Document.findByIdAndUpdate(
    documentId,
    {
      status: 'approved',
      approvedBy: approverId,
    },
    { new: true }
  ).populate('uploadedBy project task approvedBy');
};
