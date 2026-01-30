import dotenv from 'dotenv';

dotenv.config();

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),

    apiKeys: {
        cardoc: process.env.API_KEY_CARDOC || '',
        mortgage: process.env.API_KEY_MORTGAGE || '',
    },

    ollama: {
        apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
        visionTimeout: parseInt(process.env.OLLAMA_VISION_TIMEOUT || '1200000', 10), // 20 minutes for vision/OCR models on CPU
        defaultPrompt: process.env.OLLAMA_DEFAULT_PROMPT || 'Analyze this document and provide a concise summary with key information.',
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },

    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '3145728', 10), // 3MB
        allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'application/pdf,image/png,image/jpeg').split(','),
    },

    debug: {
        saveFiles: process.env.DEBUG_SAVE_FILES === 'true',
        dir: process.env.DEBUG_DIR || './debug',
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};
