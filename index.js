import express from 'express';
import dotenv from 'dotenv';
import { generateCinematicPrompt } from './claudeService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Endpoint to generate video prompts
app.post('/generate-prompt', async (req, res) => {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
        return res.status(400).json({ error: 'Missing or invalid "rawText" in request body.' });
    }

    try {
        const cinematicPrompt = await generateCinematicPrompt(rawText);
        res.status(200).json({ prompt: cinematicPrompt });
    } catch (error) {
        console.error('API Endpoint Error:', error.message);
        // We distinguish API errors (e.g. 500) or client errors (e.g. timeout could be 504)
        if (error.message.includes('timed out')) {
             return res.status(504).json({ error: 'Request to Anthropic API timed out.' });
        }
        res.status(500).json({ error: 'Failed to generate prompt.', details: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
