import { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DualOCRService } from '../services/dual-ocr.service';
import logger from '../utils/logger';
import { AnalyzeDocumentResponse, SupportedLanguage } from '../types';

const execAsync = promisify(exec);
const dualOCRService = new DualOCRService();

export class DocumentVLController {
    /**
     * Analyze document using Dual OCR: Tesseract + Vision in parallel → Text LLM Analysis
     * POST /api/v1/documents-vl/analyze
     */
    async analyzeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
        const totalStartTime = Date.now();
        let tempDir: string | null = null;

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

            // Get optional fields from headers
            const prompt = req.headers['x-prompt'] as string || 'Extract all text and data from this document and return as structured JSON.';
            const model = req.headers['x-model'] as string;

            const fileType = req.file.mimetype;
            const client = (req as any).client || 'unknown';

            logger.info(`Processing document with vision model for client: ${client}, type: ${fileType}`);

            let imageBuffer: Buffer;
            let conversionTime = 0;

            // Step 1: Convert PDF to image if needed
            if (fileType === 'application/pdf') {
                const conversionStart = Date.now();

                // Create temporary directory for conversion
                tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-intel-vl-'));
                const tempPdfPath = path.join(tempDir, 'input.pdf');
                const outputPrefix = path.join(tempDir, 'page');

                // Write PDF to temp file
                await fs.writeFile(tempPdfPath, req.file.buffer);

                // Convert PDF to PNG
                logger.info('Converting PDF to PNG for vision model...');
                await execAsync(
                    `pdftocairo -png -f 1 -l 1 -singlefile "${tempPdfPath}" "${outputPrefix}"`
                );

                // Read the generated PNG
                const pngPath = `${outputPrefix}.png`;
                imageBuffer = await fs.readFile(pngPath);

                // Debug: Save a copy to inspect if conversion worked
                const debugPath = path.join(process.cwd(), 'debug', `converted-${Date.now()}.png`);
                await fs.mkdir(path.dirname(debugPath), { recursive: true });
                await fs.writeFile(debugPath, imageBuffer);
                logger.info(`Debug: Saved converted PNG to ${debugPath}`);

                conversionTime = ((Date.now() - conversionStart) / 1000);
                logger.info(`PDF converted to PNG in ${conversionTime.toFixed(2)}s, size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
            } else if (fileType.startsWith('image/')) {
                // Already an image, use directly
                imageBuffer = req.file.buffer;
                logger.info('Using uploaded image directly');
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

            // Get language from header (default: eng)
            const language = (req.headers['x-language'] as SupportedLanguage) || 'eng';

            // Step 2: Analyze with Dual OCR (Tesseract + Vision in parallel + Text LLM)
            const dualOCRResult = await dualOCRService.analyzeImage(imageBuffer, prompt, language, model);

            const totalTime = ((Date.now() - totalStartTime) / 1000);

            // Log performance summary
            logger.info('='.repeat(60));
            logger.info('⏱️  DUAL OCR PERFORMANCE SUMMARY');
            logger.info('='.repeat(60));
            logger.info(`Client:          ${client}`);
            if (conversionTime > 0) {
                logger.info(`PDF Conversion:  ${conversionTime.toFixed(2)}s`);
            }
            logger.info(`Dual OCR Process: ${dualOCRResult.timeSeconds}s (Tesseract + Vision + LLM)`);
            logger.info(`Total Time:      ${totalTime.toFixed(2)}s`);
            logger.info('='.repeat(60));

            // Build response
            const response: AnalyzeDocumentResponse = {
                success: true,
                data: {
                    analysis: dualOCRResult.summary,
                    metadata: {
                        textLength: dualOCRResult.summary.length,
                        model: `Tesseract + ${model || 'gemma3:4b'} + llama3.2:3b`,
                        fileType,
                    },
                },
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        } finally {
            // Cleanup temp directory
            if (tempDir) {
                try {
                    await fs.rm(tempDir, { recursive: true, force: true });
                    logger.debug('Cleaned up temp directory');
                } catch (cleanupError) {
                    logger.error('Failed to cleanup temp directory:', cleanupError);
                }
            }
        }
    }

    /**
     * Health check endpoint
     * GET /api/v1/documents-vl/health
     */
    async healthCheck(_req: Request, res: Response): Promise<void> {
        res.status(200).json({
            success: true,
            message: 'Hybrid vision+LLM document intelligence API is running',
            timestamp: new Date().toISOString(),
        });
    }
}
