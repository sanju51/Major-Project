// backend/controllers/ai.controller.js
import * as ai from '../services/ai.service.js';

export const getResult = async (req, res) => {
  try {
    const { prompt } = req.query;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const result = await ai.generateResult(prompt);
    return res.send(result);
  } catch (error) {
    console.error('AI HTTP controller error:', error);

    const rawMsg = error?.message || 'AI request failed';

    if (rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota')) {
      return res
        .status(429)
        .json({ message: 'AI quota exceeded. Please try again later.' });
    }

    return res.status(500).json({ message: 'Failed to get AI result' });
  }
};

export const generateSubtasks = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Task description is required' });
    }
    const result = await ai.generateSubtasks(description);
    return res.send(result);
  } catch (error) {
    console.error('AI generate subtasks error:', error);
    return res.status(500).json({ message: 'Failed to generate subtasks' });
  }
};

export const suggestDeadline = async (req, res) => {
  try {
    const { title, complexity } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }
    const result = await ai.suggestDeadline(title, complexity);
    return res.send(result);
  } catch (error) {
    console.error('AI suggest deadline error:', error);
    return res.status(500).json({ message: 'Failed to suggest deadline' });
  }
};

export const summarizeMeeting = async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || !notes.trim()) {
      return res.status(400).json({ message: 'Meeting notes are required' });
    }
    const result = await ai.summarizeMeeting(notes);
    return res.send(result);
  } catch (error) {
    console.error('AI summarize meeting error:', error);
    return res.status(500).json({ message: 'Failed to summarize meeting' });
  }
};

export const predictRisks = async (req, res) => {
  try {
    const { projectData } = req.body;
    if (!projectData) {
      return res.status(400).json({ message: 'Project data is required' });
    }
    const result = await ai.predictRisks(projectData);
    return res.send(result);
  } catch (error) {
    console.error('AI predict risks error:', error);
    return res.status(500).json({ message: 'Failed to predict risks' });
  }
};
