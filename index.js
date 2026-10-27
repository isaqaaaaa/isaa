import express from 'express';
import dotenv from 'dotenv';
import { createPromptHandler } from './promptHandler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Endpoint to generate video prompts
app.post('/generate-prompt', createPromptHandler());

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

