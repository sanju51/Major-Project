import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'project',
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'task',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    versions: [
      {
        version: Number,
        path: String,
        size: Number,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'user',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'pending-approval', 'approved', 'rejected'],
      default: 'draft',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    },
  },
  { timestamps: true }
);

const Document = mongoose.model('document', documentSchema);

export default Document;
