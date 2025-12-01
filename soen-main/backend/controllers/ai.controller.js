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

    // If the underlying library exposes a status code, you can check it
    const rawMsg = error?.message || 'AI request failed';

    // Simple detection for quota / rate limit
    if (rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota')) {
      return res
        .status(429)
        .json({ message: 'AI quota exceeded. Please try again later.' });
    }

    return res.status(500).json({ message: 'Failed to get AI result' });
  }
};
