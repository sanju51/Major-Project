import express from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import taskRoutes from './routes/task.routes.js';
import documentRoutes from './routes/document.routes.js';
import activityRoutes from './routes/activity.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
connect();


const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use("/api/ai", aiRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/analytics', analyticsRoutes);



app.get('/', (req, res) => {
    res.send('Hello World!');
});

import { generateResult } from "./services/ai.service.js";

app.get("/test-ai", async (req, res) => {
  try {
    const response = await generateResult("Say hello in one sentence.");
    res.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});


export default app; 
