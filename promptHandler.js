import { generateCinematicPrompt } from './claudeService.js';

export function createPromptHandler(generate = generateCinematicPrompt) {
    return async (req, res) => {
        const { rawText, target = 'omniflash' } = req.body ?? {};
        if (typeof rawText !== 'string' || rawText.trim() === '') {
            return res.status(400).json({ error: 'Missing or invalid "rawText" in request body.' });
        }
        if (target !== 'omniflash' && target !== 'flow') {
            return res.status(400).json({ error: 'Invalid "target": expected "omniflash" or "flow".' });
        }
        try {
            const prompt = await generate(rawText, target);
            return res.status(200).json({ prompt });
        } catch (error) {
            if (error.message.includes('timed out')) {
                return res.status(504).json({ error: 'Request to Anthropic API timed out.' });
            }
            return res.status(500).json({ error: 'Failed to generate prompt.', details: error.message });
        }
    };
}
