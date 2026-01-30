import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';
import { config } from '../config';
import logger from '../utils/logger';
import { LLMResult, SupportedLanguage } from '../types';

export class DualOCRService {
    /**
     * Parallel Dual-OCR Processing:
     * 1. Run Tesseract OCR (fast, good for printed text)
     * 2. Run Vision Model OCR in parallel (good for handwritten, timeout 3 mins)
     * 3. Combine both OCR results
     * 4. Feed combined text to LLM for final analysis
     */
    async analyzeImage(
        imageBuffer: Buffer,
        analysisPrompt?: string,
        language: SupportedLanguage = 'eng',
        visionModel?: string,
        textModel?: string
    ): Promise<LLMResult> {
        const totalStartTime = Date.now();
        const sessionId = uuidv4();
        const useVisionModel = visionModel || 'gemma3:4b';
        const useTextModel = textModel || config.ollama.model;
        const visionTimeout = 80000; // 80 seconds for vision OCR (Cloudflare timeout workaround)

        try {
            logger.info(`[${sessionId}] 🚀 Starting DUAL OCR (Tesseract + Vision) processing...`);
            logger.info(`[${sessionId}] Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

            // Run BOTH OCR methods in parallel (no optimization - preserve quality)
            logger.info(`[${sessionId}] Running Tesseract and Vision OCR in parallel...`);
            const parallelStartTime = Date.now();

            const [tesseractResult, visionResult] = await Promise.allSettled([
                // Tesseract OCR (fast, reliable for printed text)
                this.runTesseractOCR(imageBuffer, language, sessionId),
                // Vision Model OCR (better for handwritten, poor quality)
                this.runVisionOCR(imageBuffer, useVisionModel, sessionId, visionTimeout),
            ]);

            const parallelTime = ((Date.now() - parallelStartTime) / 1000);
            logger.info(`[${sessionId}] ⏱️  Parallel OCR completed in ${parallelTime.toFixed(2)}s`);

            // Extract text from results
            let tesseractText = '';
            let visionText = '';

            if (tesseractResult.status === 'fulfilled') {
                tesseractText = tesseractResult.value;
                logger.info(`[${sessionId}] ✅ Tesseract: ${tesseractText.length} chars extracted`);
                if (tesseractText) {
                    logger.info(`[${sessionId}] 📄 Tesseract output preview:\n${tesseractText.substring(0, 500)}...`);
                }
            } else {
                logger.warn(`[${sessionId}] ⚠️  Tesseract failed: ${tesseractResult.reason}`);
            }

            if (visionResult.status === 'fulfilled') {
                visionText = visionResult.value;
                logger.info(`[${sessionId}] ✅ Vision: ${visionText.length} chars extracted`);
                if (visionText) {
                    logger.info(`[${sessionId}] 👁️  Vision output preview:\n${visionText.substring(0, 500)}...`);
                } else {
                    logger.warn(`[${sessionId}] ⚠️  Vision returned empty text (model may have failed silently)`);
                }
            } else {
                logger.warn(`[${sessionId}] ⚠️  Vision OCR failed or timed out (3min limit): ${visionResult.reason}`);
            }

            // Combine both OCR results
            const combinedText = this.combineOCRResults(tesseractText, visionText, sessionId);

            if (!combinedText) {
                throw new Error('Both OCR methods failed to extract any text');
            }

            // Step 3: Text Analysis with LLM using combined OCR
            logger.info(`[${sessionId}] Step 3: Analyzing combined OCR with text model (${useTextModel})...`);
            const analysisStartTime = Date.now();

            const finalPrompt = analysisPrompt ||
                'Analyze the following document text and extract key information as structured JSON. Return only valid JSON without markdown formatting.';

            // Enhanced prompt to explain dual OCR context
            const contextualPrompt = `${finalPrompt}

IMPORTANT: The text below comes from TWO different OCR methods applied to the SAME document:
1. Tesseract OCR (fast, may have typos/formatting issues)
2. Vision Model OCR (slower, better structured)

Both are reading the SAME document. Cross-reference both outputs to extract the most accurate information.
When there are discrepancies, prefer the cleaner, more structured output.

${combinedText}`;

            const analysisResponse = await axios.post(
                `${config.ollama.apiUrl}/api/generate`,
                {
                    model: useTextModel,
                    prompt: contextualPrompt,
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
            logger.info(`[${sessionId}] 🎯 DUAL OCR SUMMARY:`);
            logger.info(`[${sessionId}]   - Tesseract: ${tesseractResult.status === 'fulfilled' ? '✅' : '❌'} (${tesseractText.length} chars)`);
            logger.info(`[${sessionId}]   - Vision:    ${visionResult.status === 'fulfilled' ? '✅' : '❌'} (${visionText.length} chars)`);
            logger.info(`[${sessionId}]   - Combined:  ${combinedText.length} chars`);
            logger.info(`[${sessionId}]   - Total time: ${totalTime.toFixed(2)}s`);

            // Log final LLM output to console
            logger.info(`[${sessionId}] 📊 FINAL LLM OUTPUT:\n${analysis}`);

            if (!analysis) {
                throw new Error('Text model returned empty analysis');
            }

            return {
                summary: analysis,
                timeSeconds: parseFloat(totalTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Dual OCR processing error:`, error);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Dual OCR processing request timed out');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Model not found - ensure both vision and text models are available`);
                }
            }

            throw new Error(
                `Failed to process with dual OCR: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Run Tesseract OCR
     */
    private async runTesseractOCR(imageBuffer: Buffer, language: SupportedLanguage, sessionId: string): Promise<string> {
        const startTime = Date.now();
        logger.info(`[${sessionId}] 📄 Tesseract OCR starting...`);

        const { data: { text } } = await Tesseract.recognize(imageBuffer, language);

        const time = ((Date.now() - startTime) / 1000);
        logger.info(`[${sessionId}] 📄 Tesseract completed in ${time.toFixed(2)}s`);

        return text.trim();
    }

    /**
     * Run Vision Model OCR with timeout
     */
    private async runVisionOCR(imageBuffer: Buffer, model: string, sessionId: string, timeout: number): Promise<string> {
        const startTime = Date.now();
        logger.info(`[${sessionId}] 👁️  Vision OCR starting (${model}, 3min timeout)...`);

        const imageBase64 = imageBuffer.toString('base64');

        const response = await axios.post(
            `${config.ollama.apiUrl}/api/generate`,
            {
                model: model,
                prompt: 'Extract all text from this image. Return only the raw text without any formatting or additional comments.',
                images: [imageBase64],
                stream: false,
            },
            {
                timeout: timeout,
            }
        );

        const extractedText = response.data.response ? response.data.response.trim() : '';
        const time = ((Date.now() - startTime) / 1000);

        logger.info(`[${sessionId}] 👁️  Vision OCR completed in ${time.toFixed(2)}s`);

        return extractedText;
    }

    /**
     * Combine OCR results intelligently
     * Strategy: Use Tesseract as primary (faster, more reliable for printed text)
     * Add vision text if it provides additional unique content
     */
    private combineOCRResults(tesseractText: string, visionText: string, sessionId: string): string {
        // If only one succeeded, use it
        if (!tesseractText && visionText) {
            logger.info(`[${sessionId}] 🔀 Using Vision OCR only (Tesseract failed)`);
            return visionText;
        }
        if (tesseractText && !visionText) {
            logger.info(`[${sessionId}] 🔀 Using Tesseract OCR only (Vision failed/timeout)`);
            return tesseractText;
        }

        // Both succeeded - combine them
        logger.info(`[${sessionId}] 🔀 Combining both OCR results...`);

        // Use Tesseract as primary, add vision as supplementary
        return `=== PRIMARY OCR (Tesseract) ===\n${tesseractText}\n\n=== SUPPLEMENTARY OCR (Vision Model) ===\n${visionText}`;
    }
}
