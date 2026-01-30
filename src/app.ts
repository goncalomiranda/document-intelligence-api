import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import documentRoutes from './routes/document.routes';
import documentVLRoutes from './routes/document-vl.routes';
import magicOCRRoutes from './routes/magic-ocr.routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import logger from './utils/logger';

export const createApp = (): Application => {
    const app = express();

    // Trust proxy for Cloudflare and other reverse proxies
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmet());
    app.use(cors());

    // Body parsing middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, _res, next) => {
        logger.info(`${req.method} ${req.path}`);
        next();
    });

    // API routes
    app.use('/api/v1', documentRoutes);
    app.use('/api/v1/documents-vl', documentVLRoutes);
    app.use('/api/v1/magic-ocr', magicOCRRoutes);

    // Root endpoint
    app.get('/', (_req, res) => {
        res.json({
            success: true,
            message: 'Document Intelligence API',
            version: '1.0.0',
            endpoints: {
                health: 'GET /api/v1/health',
                analyze: 'POST /api/v1/documents/analyze',
                healthVL: 'GET /api/v1/documents-vl/health',
                analyzeVL: 'POST /api/v1/documents-vl/analyze (Vision Model)',
                healthMagicOCR: 'GET /api/v1/magic-ocr/health',
                analyzeMagicOCR: 'POST /api/v1/magic-ocr/analyze (deepseek-ocr)',
            },
        });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    return app;
};
