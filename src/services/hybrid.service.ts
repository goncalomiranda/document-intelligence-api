import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { config } from '../config';
import logger from '../utils/logger';
import { LLMResult } from '../types';

export class HybridService {
    /**
     * Two-step processing:
     * 1. Use vision model (qwen3-vl:2b) for OCR extraction
     * 2. Use text model (llama3.2:3b) for analysis based on OCR output
     */
    async analyzeImage(imageBuffer: Buffer, analysisPrompt?: string, visionModel?: string, textModel?: string): Promise<LLMResult> {
        const totalStartTime = Date.now();
        const sessionId = uuidv4();
        const useVisionModel = visionModel || 'gemma3:4b';
        const useTextModel = textModel || config.ollama.model;

        try {
            // Optimize image before processing
            logger.info(`[${sessionId}] Original image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

            const optimizedImage = await sharp(imageBuffer)
                .resize(1024, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 75 })
                .toBuffer();

            logger.info(`[${sessionId}] Optimized image size: ${(optimizedImage.length / 1024).toFixed(2)} KB`);

            // Step 1: OCR Extraction with Vision Model
            logger.info(`[${sessionId}] Step 1: Extracting text with vision model (${useVisionModel})...`);
            const ocrStartTime = Date.now();

            const imageBase64 = optimizedImage.toString('base64');

            const ocrResponse = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: useVisionModel,
                    prompt: 'Extract all text from this image. Return only the raw text without any formatting or additional comments.',
                    images: [imageBase64],
                    stream: false,
                },
                {
                    timeout: config.ollama.visionTimeout,
                }
            );

            const extractedText = ocrResponse.data.response ? ocrResponse.data.response.trim() : '';
            const ocrTime = ((Date.now() - ocrStartTime) / 1000);

            logger.info(`[${sessionId}] OCR completed in ${ocrTime.toFixed(2)}s, extracted ${extractedText.length} chars`);

            // Log first 200 chars to debug what was extracted
            if (extractedText) {
                logger.info(`[${sessionId}] Extracted text preview: ${extractedText.substring(0, 200)}...`);
            } else {
                logger.warn(`[${sessionId}] Vision model response was empty or whitespace only`);
                logger.debug(`[${sessionId}] Full OCR response:`, JSON.stringify(ocrResponse.data));
            }

            if (!extractedText) {
                throw new Error('Vision model returned empty text - image may be blank, corrupted, or model failed');
            }

            // Step 2: Text Analysis with LLM
            logger.info(`[${sessionId}] Step 2: Analyzing with text model (${useTextModel})...`);
            const analysisStartTime = Date.now();

            const finalPrompt = analysisPrompt ||
                'Analyze the following document text and extract key information as structured JSON. Return only valid JSON without markdown formatting.';

            const analysisResponse = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: useTextModel,
                    prompt: `${finalPrompt}\n\nDocument text:\n${extractedText}`,
                    stream: false,
                },
                {
                    timeout: config.ollama.timeout,
                }
            );

            const analysis = analysisResponse.data.response ? analysisResponse.data.response.trim() : '';
            const analysisTime = ((Date.now() - analysisStartTime) / 1000);
            const totalTime = ((Date.now() - totalStartTime) / 1000);

            logger.info(`[${sessionId}] Analysis completed in ${analysisTime.toFixed(2)}s`);
            logger.info(`[${sessionId}] Total hybrid processing time: ${totalTime.toFixed(2)}s`);
            logger.info(`[${sessionId}]   - Vision OCR: ${ocrTime.toFixed(2)}s`);
            logger.info(`[${sessionId}]   - Text LLM: ${analysisTime.toFixed(2)}s`);

            if (!analysis) {
                throw new Error('Text model returned empty analysis');
            }

            return {
                summary: analysis,
                timeSeconds: parseFloat(totalTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Hybrid processing error:`, error);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Hybrid processing request timed out');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Model not found - ensure both vision and text models are available`);
                }
            }

            throw new Error(
                `Failed to process with hybrid approach: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
