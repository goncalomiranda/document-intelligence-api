import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../utils/logger';

const VALID_API_KEYS = new Set([
    config.apiKeys.cardoc,
    config.apiKeys.mortgage,
]);

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.header('X-API-Key');

    if (!apiKey) {
        res.status(401).json({
            success: false,
            error: {
                message: 'API key is required',
                code: 'MISSING_API_KEY',
            },
        });
        return;
    }

    if (!VALID_API_KEYS.has(apiKey)) {
        logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 8)}...`);
        res.status(401).json({
            success: false,
            error: {
                message: 'Invalid API key',
                code: 'INVALID_API_KEY',
            },
        });
        return;
    }

    // Attach client info to request
    if (apiKey === config.apiKeys.cardoc) {
        (req as any).client = 'cardoc';
    } else if (apiKey === config.apiKeys.mortgage) {
        (req as any).client = 'mortgage';
    }

    logger.info(`Authenticated request from client: ${(req as any).client}`);
    next();
};
