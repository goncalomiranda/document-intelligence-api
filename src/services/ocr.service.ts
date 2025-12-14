import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import Tesseract from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { OCRResult } from '../types';

const execAsync = promisify(exec);

export class OCRService {
    /**
     * Extract text from PDF using pdftocairo + Tesseract OCR
     * Workflow: PDF → PNG (pdftocairo) → Tesseract OCR → Text
     */
    async extractTextFromPDF(
        pdfBuffer: Buffer,
        language: string = 'eng'
    ): Promise<OCRResult> {
        let tempDir: string | null = null;
        const startTime = Date.now();
        const sessionId = uuidv4();

        try {
            logger.info(`[${sessionId}] Starting PDF OCR extraction`);

            // Create debug directory if enabled
            if (config.debug.saveFiles) {
                await fs.mkdir(config.debug.dir, { recursive: true });
            }

            // Create temporary directory for conversion
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-intel-'));
            const tempPdfPath = path.join(tempDir, 'input.pdf');
            const outputPrefix = path.join(tempDir, 'page');

            // Write PDF to temp file
            await fs.writeFile(tempPdfPath, pdfBuffer);

            // Convert PDF to PNG using pdftocairo
            logger.info(`[${sessionId}] Converting PDF to PNG...`);
            await execAsync(
                `pdftocairo -png -f 1 -l 1 -singlefile "${tempPdfPath}" "${outputPrefix}"`
            );

            // Read the generated PNG
            const pngPath = `${outputPrefix}.png`;
            const pngBuffer = await fs.readFile(pngPath);

            // Save debug files if enabled
            if (config.debug.saveFiles) {
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const debugPngPath = path.join(config.debug.dir, `pdf-${timestamp}.png`);
                await fs.copyFile(pngPath, debugPngPath);
                logger.info(`[${sessionId}] PNG saved to: ${debugPngPath}`);
            }

            // Run Tesseract OCR
            logger.info(`[${sessionId}] Running Tesseract OCR...`);
            const { data: { text } } = await Tesseract.recognize(pngBuffer, language, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        logger.debug(`[${sessionId}] OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            const ocrTime = ((Date.now() - startTime) / 1000);
            logger.info(
                `[${sessionId}] OCR completed in ${ocrTime.toFixed(2)}s, extracted ${text.length} characters`
            );

            if (!text || !text.trim()) {
                throw new Error('No text extracted from PDF image');
            }

            // Save extracted text if debug enabled
            if (config.debug.saveFiles) {
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const debugTxtPath = path.join(config.debug.dir, `ocr-${timestamp}.txt`);
                await fs.writeFile(debugTxtPath, text, 'utf8');
                logger.info(`[${sessionId}] OCR text saved to: ${debugTxtPath}`);
            }

            return {
                text: text.trim(),
                timeSeconds: parseFloat(ocrTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] PDF OCR extraction error:`, error);
            throw new Error(
                `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            // Cleanup temp directory
            if (tempDir) {
                try {
                    await fs.rm(tempDir, { recursive: true, force: true });
                    logger.debug(`[${sessionId}] Cleaned up temp directory`);
                } catch (cleanupError) {
                    logger.error(`[${sessionId}] Failed to cleanup temp directory:`, cleanupError);
                }
            }
        }
    }

    /**
     * Extract text from image using Tesseract OCR
     */
    async extractTextFromImage(
        imageBuffer: Buffer,
        language: string = 'eng'
    ): Promise<OCRResult> {
        const startTime = Date.now();
        const sessionId = uuidv4();

        try {
            logger.info(`[${sessionId}] Starting image OCR extraction`);

            const { data: { text } } = await Tesseract.recognize(imageBuffer, language, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        logger.debug(`[${sessionId}] OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            const ocrTime = ((Date.now() - startTime) / 1000);
            logger.info(
                `[${sessionId}] OCR completed in ${ocrTime.toFixed(2)}s, extracted ${text.length} characters`
            );

            if (!text || !text.trim()) {
                throw new Error('No text extracted from image');
            }

            // Save extracted text if debug enabled
            if (config.debug.saveFiles) {
                await fs.mkdir(config.debug.dir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const debugTxtPath = path.join(config.debug.dir, `ocr-${timestamp}.txt`);
                await fs.writeFile(debugTxtPath, text, 'utf8');
                logger.info(`[${sessionId}] OCR text saved to: ${debugTxtPath}`);
            }

            return {
                text: text.trim(),
                timeSeconds: parseFloat(ocrTime.toFixed(2)),
            };
        } catch (error) {
            logger.error(`[${sessionId}] Image OCR extraction error:`, error);
            throw new Error(
                `Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
