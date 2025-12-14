import { createApp } from './app';
import { config } from './config';
import logger from './utils/logger';

const app = createApp();

app.listen(config.port, () => {
    logger.info(`🚀 Document Intelligence API running on port ${config.port}`);
    logger.info(`📝 Environment: ${config.env}`);
    logger.info(`🔗 Ollama URL: ${config.ollama.apiUrl}`);
    logger.info(`🤖 Default Model: ${config.ollama.model}`);
    logger.info(`📊 Debug mode: ${config.debug.saveFiles ? 'ON' : 'OFF'}`);
    logger.info('\nEndpoints:');
    logger.info(`  GET  http://localhost:${config.port}/api/v1/health`);
    logger.info(`  POST http://localhost:${config.port}/api/v1/documents/analyze`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});
