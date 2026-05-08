import { Router } from 'express';
import { body } from 'express-validator';
import * as projectController from '../controllers/project.controller.js';
import * as authMiddleWare from '../middleware/auth.middleware.js';

const router = Router();


router.post('/create',
    authMiddleWare.authUser,
    body('name').isString().withMessage('Name is required'),
    projectController.createProject
)

router.get('/all',
    authMiddleWare.authUser,
    projectController.getAllProject
)

router.put('/add-user',
    authMiddleWare.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('users').isArray({ min: 1 }).withMessage('Users must be an array'),
    authMiddleWare.checkProjectRole(['owner', 'admin']),
    projectController.addUserToProject
)

router.get('/get-project/:projectId',
    authMiddleWare.authUser,
    authMiddleWare.checkProjectRole(['owner', 'admin', 'developer', 'tester', 'viewer']),
    projectController.getProjectById
)

router.put('/update-file-tree',
    authMiddleWare.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('fileTree').isObject().withMessage('File tree is required'),
    authMiddleWare.checkProjectRole(['owner', 'admin', 'developer']),
    projectController.updateFileTree
)

router.get('/gantt/:projectId',
    authMiddleWare.authUser,
    authMiddleWare.checkProjectRole(['owner', 'admin', 'developer', 'tester', 'viewer']),
    projectController.getGanttData
)

router.get('/budget/:projectId',
    authMiddleWare.authUser,
    authMiddleWare.checkProjectRole(['owner', 'admin']),
    projectController.getBudgetData
)


export default router;