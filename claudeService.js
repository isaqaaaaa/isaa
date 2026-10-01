import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional video director. Your task is to take a raw idea or description for a video and turn it into a continuous, cinematic paragraph in English, optimized as a prompt for a video generation model called Omniflash. Do not include any variables, timecodes, or structural formatting (like lists or bullet points). Output only the pure, vivid, cinematic description of the video.`;

/**
 * Sends a raw text description to Claude and returns a cinematic video generation prompt.
 *
 * @param {string} rawText - The raw video description or idea.
 * @returns {Promise<string>} The generated cinematic prompt for Omniflash.
 */
export async function generateCinematicPrompt(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Invalid input: raw text must be a non-empty string.');
    }

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307', // Using haiku for speed, can be upgraded to sonnet or opus
            max_tokens: 500,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: rawText }
            ]
        }, { timeout: 15000 }); // 15 seconds timeout

        // Extract and return the generated text
        if (response.content && response.content.length > 0) {
            return response.content[0].text.trim();
        } else {
             throw new Error('Received empty response from Anthropic API.');
        }

    } catch (error) {
        console.error('Error generating prompt with Claude:', error);

        if (error instanceof Anthropic.APIConnectionTimeoutError) {
             throw new Error('Anthropic API request timed out.');
        } else if (error instanceof Anthropic.APIError) {
            throw new Error(`Anthropic API Error: ${error.message} (Status: ${error.status})`);
        }

        throw new Error(`Failed to generate prompt: ${error.message}`);
    }
}
