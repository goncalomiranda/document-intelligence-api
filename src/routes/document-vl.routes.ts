import { Router } from 'express';
import multer from 'multer';
import { DocumentVLController } from '../controllers/document-vl.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import { config } from '../config';

const router = Router();
const documentVLController = new DocumentVLController();

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
router.get('/health', documentVLController.healthCheck.bind(documentVLController));

// Vision-based document analysis endpoint (with auth and rate limiting)
router.post(
    '/analyze',
    authenticate,
    rateLimiter,
    upload.single('file'),
    documentVLController.analyzeDocument.bind(documentVLController)
);

export default router;
