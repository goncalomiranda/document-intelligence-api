import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import { config } from '../config';

const router = Router();
const documentController = new DocumentController();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.upload.maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
        if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
    },
});

// Health check (no auth required)
router.get('/health', documentController.healthCheck.bind(documentController));

// Document analysis endpoint (with auth and rate limiting)
router.post(
    '/documents/analyze',
    authenticate,
    rateLimiter,
    upload.single('file'),
    documentController.analyzeDocument.bind(documentController)
);

export default router;
