import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['project-created', 'project-updated', 'project-deleted', 'task-created', 'task-updated', 'task-deleted', 'document-uploaded', 'user-added', 'user-removed'],
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    changes: {
      type: Object,
    },
  },
  { timestamps: true }
);

const Activity = mongoose.model('activity', activitySchema);

export default Activity;
