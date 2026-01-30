import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { LLMResult } from '../types';

export class VisionService {
    /**
     * Analyze image directly using Ollama Vision model (qwen3-vl)
     * No OCR needed - the vision model reads text from the image
     */
    async analyzeImage(imageBuffer: Buffer, prompt: string, model?: string): Promise<LLMResult> {
        const startTime = Date.now();
        const sessionId = uuidv4();
        const visionModel = model || 'gemma3:4b';

        try {
            logger.info(`[${sessionId}] Sending image to Ollama vision model (${visionModel}) for analysis...`);

            // Convert image buffer to base64
            const imageBase64 = imageBuffer.toString('base64');

            logger.info(`[${sessionId}] Image size: ${(imageBase64.length / 1024).toFixed(2)} KB (base64)`);

            const response = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: visionModel,
                    prompt: prompt,
                    images: [imageBase64],
                    stream: false,
                },
                {
                    timeout: config.ollama.visionTimeout, // Use longer timeout for vision
                }
            );

            const result = response.data.response ? response.data.response.trim() : '';
            const visionTime = ((Date.now() - startTime) / 1000);

            logger.info(
                `[${sessionId}] Vision analysis received in ${visionTime.toFixed(2)}s, length: ${result.length}`
            );

            if (!result) {
                throw new Error('Empty analysis received from vision model');
            }

            return {
                summary: result,
                timeSeconds: parseFloat(visionTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Vision model analysis error:`, error);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Vision model request timed out - try a smaller image or increase timeout');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Vision model '${visionModel}' not found - please pull it with 'ollama pull ${visionModel}'`);
                }
            }

            throw new Error(
                `Failed to analyze image with vision model: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
