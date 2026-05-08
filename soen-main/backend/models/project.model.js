import mongoose from 'mongoose';


const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: [ true, 'Project name must be unique' ],
    },
    description: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['planned', 'active', 'on-hold', 'completed'],
        default: 'planned',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },
    projectType: {
        type: String,
        enum: ['web-app', 'mobile-app', 'ai-ml', 'data-science', 'devops', 'other'],
        default: 'other',
    },
    category: {
        type: String,
        enum: ['Software Development', 'Marketing', 'Business', 'Design', 'Other'],
        default: 'Software Development',
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    budget: {
        type: Number,
        default: 0,
    },
    spent: {
        type: Number,
        default: 0,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: false,
    },
    users: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'user',
            },
            role: {
                type: String,
                enum: ['owner', 'admin', 'developer', 'tester', 'viewer'],
                default: 'viewer',
            },
        },
    ],
    fileTree: {
        type: Object,
        default: {},
    },
}, { timestamps: true });


const Project = mongoose.model('project', projectSchema)


export default Project;
