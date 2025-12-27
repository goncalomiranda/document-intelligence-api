export type SupportedLanguage = 'eng' | 'por';

export interface AnalyzeDocumentRequest {
    prompt: string;
    model?: string;
    language?: SupportedLanguage;
    saveDebug?: boolean;
}

export interface AnalyzeDocumentResponse {
    success: boolean;
    data: {
        analysis: string;
        metadata: {
            textLength: number;
            model: string;
            fileType: string;
        };
    };
    error?: string;
}

export interface OCRResult {
    text: string;
    timeSeconds: number;
}

export interface LLMResult {
    summary: string;
    timeSeconds: number;
}

export interface ApiError {
    success: false;
    error: {
        message: string;
        code: string;
        details?: any;
    };
}
