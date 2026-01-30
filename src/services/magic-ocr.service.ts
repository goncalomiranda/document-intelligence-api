import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { config } from '../config';
import logger from '../utils/logger';
import { LLMResult } from '../types';

export class MagicOCRService {
    /**
     * Extract text from image using deepseek-ocr vision model
     * This model is designed for pure OCR text extraction
     */
    async analyzeImage(imageBuffer: Buffer, _prompt?: string, model?: string): Promise<LLMResult> {
        const startTime = Date.now();
        const sessionId = uuidv4();
        const ocrModel = model || 'gemma3:4b';

        // deepseek-ocr requires specific prompts - use OCR extraction prompt
        const ocrPrompt = 'Extract the text in the image.';

        try {
            logger.info(`[${sessionId}] Sending image to Magic OCR model (${ocrModel}) for text extraction...`);
            logger.info(`[${sessionId}] Original image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

            // Optimize image: resize to max 1024px width and convert to JPEG with lower quality
            const optimizedBuffer = await sharp(imageBuffer)
                .resize(1024, null, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 75 })
                .toBuffer();

            logger.info(`[${sessionId}] Optimized image size: ${(optimizedBuffer.length / 1024).toFixed(2)} KB`);

            // Convert image buffer to base64
            const imageBase64 = optimizedBuffer.toString('base64');

            const response = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: ocrModel,
                    prompt: ocrPrompt,
                    images: [imageBase64],
                    stream: false,
                },
                {
                    timeout: config.ollama.visionTimeout,
                }
            );

            // Debug: log the raw response structure
            logger.info(`[${sessionId}] Raw response keys: ${Object.keys(response.data).join(', ')}`);
            logger.info(`[${sessionId}] Raw response.data: ${JSON.stringify(response.data).substring(0, 500)}`);

            const result = response.data.response ? response.data.response.trim() : '';
            const processingTime = ((Date.now() - startTime) / 1000);

            logger.info(
                `[${sessionId}] Magic OCR extraction received in ${processingTime.toFixed(2)}s, length: ${result.length}`
            );

            if (!result) {
                throw new Error('Empty text extracted from Magic OCR model');
            }

            return {
                summary: result,
                timeSeconds: parseFloat(processingTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Magic OCR model error:`, error);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Magic OCR request timed out - try a smaller image or increase timeout');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Magic OCR model '${ocrModel}' not found - please pull it with 'ollama pull ${ocrModel}'`);
                }
            }

            throw new Error(
                `Failed to extract text with Magic OCR model: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
