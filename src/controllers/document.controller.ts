import { Request, Response, NextFunction } from 'express';
import { OCRService } from '../services/ocr.service';
import { LLMService } from '../services/llm.service';
import logger from '../utils/logger';
import { AnalyzeDocumentResponse } from '../types';
import { config } from '../config';

const ocrService = new OCRService();
const llmService = new LLMService();

export class DocumentController {
    /**
     * Analyze document: Extract text via OCR and analyze with LLM
     * POST /api/v1/documents/analyze
     */
    async analyzeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
        const totalStartTime = Date.now();

        try {
            // Validate file upload
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'No file uploaded',
                        code: 'MISSING_FILE',
                    },
                });
                return;
            }

            // Get optional fields from headers and body
            const prompt = req.headers['x-prompt'] as string || config.ollama.defaultPrompt;
            const model = req.headers['x-model'] as string;
            const language = req.headers['x-language'] as string || 'eng';

            const fileType = req.file.mimetype;
            const client = (req as any).client || 'unknown';

            logger.info(`Processing document for client: ${client}, type: ${fileType}`);

            // Step 1: Extract text via OCR
            let ocrResult;

            if (fileType === 'application/pdf') {
                ocrResult = await ocrService.extractTextFromPDF(req.file.buffer, language);
            } else if (fileType.startsWith('image/')) {
                ocrResult = await ocrService.extractTextFromImage(req.file.buffer, language);
            } else {
                res.status(400).json({
                    success: false,
                    error: {
                        message: `Unsupported file type: ${fileType}`,
                        code: 'UNSUPPORTED_FILE_TYPE',
                    },
                });
                return;
            }

            logger.info(`OCR completed: ${ocrResult.text.length} characters in ${ocrResult.timeSeconds}s`);

            // Step 2: Analyze with LLM
            const llmResult = await llmService.analyzeText(ocrResult.text, prompt, model);

            const totalTime = ((Date.now() - totalStartTime) / 1000);

            // Log performance summary
            logger.info('='.repeat(60));
            logger.info('⏱️  PERFORMANCE SUMMARY');
            logger.info('='.repeat(60));
            logger.info(`Client:          ${client}`);
            logger.info(`OCR Time:        ${ocrResult.timeSeconds}s`);
            logger.info(`LLM Time:        ${llmResult.timeSeconds}s`);
            logger.info(`Total Time:      ${totalTime.toFixed(2)}s`);
            logger.info('='.repeat(60));

            // Build response
            const response: AnalyzeDocumentResponse = {
                success: true,
                data: {
                    analysis: llmResult.summary,
                    metadata: {
                        textLength: ocrResult.text.length,
                        model: model || 'llama3.2:3b',
                        fileType,
                    },
                },
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Health check endpoint
     * GET /api/v1/health
     */
    async healthCheck(_req: Request, res: Response): Promise<void> {
        res.status(200).json({
            success: true,
            message: 'Document Intelligence API is running',
            timestamp: new Date().toISOString(),
        });
    }
}
