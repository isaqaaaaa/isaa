import express from 'express';
import dotenv from 'dotenv';
import { createPromptHandler } from './promptHandler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = '127.0.0.1';

// Middleware to parse JSON request bodies
app.use(express.json());

// Endpoint to generate video prompts
app.post('/generate-prompt', createPromptHandler());

// Start the server
app.listen(port, host, () => {
    console.log(`Server listening at http://${host}:${port}`);
});
