import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { LLMResult } from '../types';

export class LLMService {
    /**
     * Analyze text using Ollama LLM with custom prompt
     */
    async analyzeText(text: string, prompt: string, model?: string): Promise<LLMResult> {
        const startTime = Date.now();
        const sessionId = uuidv4();
        const llmModel = model || config.ollama.model;

        try {
            logger.info(`[${sessionId}] Sending text to Ollama (${llmModel}) for analysis...`);
            logger.debug(`[${sessionId}] Text length: ${text.length}, Prompt length: ${prompt.length}`);

            const fullPrompt = `${prompt}\n\n${text}`;

            const response = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: llmModel,
                    prompt: fullPrompt,
                    stream: false,
                },
                {
                    timeout: config.ollama.timeout,
                }
            );

            const summary = response.data.response ? response.data.response.trim() : '';
            const llmTime = ((Date.now() - startTime) / 1000);

            logger.info(
                `[${sessionId}] Analysis received in ${llmTime.toFixed(2)}s, length: ${summary.length}`
            );

            if (!summary) {
                throw new Error('Empty analysis received from Ollama');
            }

            return {
                summary,
                timeSeconds: parseFloat(llmTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Ollama analysis error:`, error);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('LLM request timed out - try a shorter document or increase timeout');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Model '${llmModel}' not found - please pull it with 'ollama pull ${llmModel}'`);
                }
            }

            throw new Error(
                `Failed to analyze text with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
