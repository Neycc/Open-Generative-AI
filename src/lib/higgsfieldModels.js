const qwenImage3 = {
    id: 'qwen-image-3',
    name: 'Qwen Image 3',
    provider: 'Higgsfield',
    endpoint: 'alibaba/qwen-image-3/text-to-image',
    promptRequired: true,
    inputs: {
        prompt: { type: 'string', name: 'prompt', title: 'Prompt' },
        resolution: { type: 'string', name: 'resolution', title: 'Resolution', enum: ['1k', '2k'], default: '1k' },
        aspect_ratio: { type: 'string', name: 'aspect_ratio', title: 'Aspect Ratio', enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '7:9', '9:7', '9:16', '16:9', '21:9'], default: '1:1' },
        prompt_extend: { type: 'boolean', name: 'prompt_extend', title: 'Enhance Prompt', default: true },
        enable_thinking: { type: 'boolean', name: 'enable_thinking', title: 'Thinking Mode', default: true },
        prompt_extend_mode: { type: 'string', name: 'prompt_extend_mode', title: 'Prompt Enhancement', enum: ['direct', 'agent'], default: 'direct' },
    },
};

const seedance25 = {
    id: 'seedance-2.5',
    name: 'Seedance 2.5',
    provider: 'Higgsfield',
    endpoint: 'bytedance/seedance-2.5/text-to-video',
    promptRequired: true,
    inputs: {
        prompt: { type: 'string', name: 'prompt', title: 'Prompt' },
        duration: { type: 'integer', name: 'duration', title: 'Duration', enum: [4, 5, 8, 10, 15, 20, 25, 30], default: 5 },
        resolution: { type: 'string', name: 'resolution', title: 'Resolution', enum: ['480p', '720p', '1080p'], default: '720p' },
        aspect_ratio: { type: 'string', name: 'aspect_ratio', title: 'Aspect Ratio', enum: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], default: '16:9' },
        output_format: { type: 'string', name: 'output_format', title: 'Output Format', enum: ['mp4', 'mov'], default: 'mp4' },
        generate_audio: { type: 'boolean', name: 'generate_audio', title: 'Generate Audio', default: true },
    },
};

const minimaxH3 = {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    provider: 'Higgsfield',
    endpoint: 'minimax/h3/text-to-video',
    promptRequired: true,
    inputs: {
        prompt: { type: 'string', name: 'prompt', title: 'Prompt' },
        duration: { type: 'integer', name: 'duration', title: 'Duration', enum: [5, 10, 15], default: 5 },
        resolution: { type: 'string', name: 'resolution', title: 'Resolution', enum: ['2K'], default: '2K' },
        aspect_ratio: { type: 'string', name: 'aspect_ratio', title: 'Aspect Ratio', enum: ['auto', 'adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], default: 'auto' },
        aigc_watermark: { type: 'boolean', name: 'aigc_watermark', title: 'AIGC Watermark', default: false },
    },
};

export const t2iModels = [qwenImage3];
export const i2iModels = [];
export const t2vModels = [seedance25, minimaxH3];
export const i2vModels = [];
export const v2vModels = [];

function fieldValues(model, field, fallback = []) {
    const values = model?.inputs?.[field]?.enum;
    return Array.isArray(values) && values.length ? values : fallback;
}

function getById(models, id) {
    return models.find((model) => model.id === id) || null;
}

export function getAspectRatiosForModel(id) {
    return fieldValues(getById(t2iModels, id), 'aspect_ratio', ['1:1']);
}
export function getResolutionsForModel(id) {
    return fieldValues(getById(t2iModels, id), 'resolution', ['1k']);
}
export function getQualityFieldForModel() { return null; }
export function getAspectRatiosForI2IModel() { return []; }
export function getResolutionsForI2IModel() { return []; }
export function getQualityFieldForI2IModel() { return null; }
export function getMaxImagesForI2IModel() { return 0; }

export function getAspectRatiosForVideoModel(id) {
    return fieldValues(getById(t2vModels, id), 'aspect_ratio', ['16:9']);
}
export function getDurationsForModel(id) {
    return fieldValues(getById(t2vModels, id), 'duration', [5]);
}
export function getResolutionsForVideoModel(id) {
    return fieldValues(getById(t2vModels, id), 'resolution', ['720p']);
}
export function getAspectRatiosForI2VModel() { return []; }
export function getDurationsForI2VModel() { return []; }
export function getResolutionsForI2VModel() { return []; }
