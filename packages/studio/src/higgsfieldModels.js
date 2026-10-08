import * as catalog from './models.js';

const findModels = (models, terms) => models.filter((model) => {
    const text = `${model?.id || ''} ${model?.name || ''} ${model?.endpoint || ''}`.toLowerCase();
    return terms.some((term) => text.includes(term));
});
const field = (name, title, type, values, value) => ({
    type, name, title, ...(values ? { enum: values } : {}), ...(value !== undefined ? { default: value } : {}),
});
const withInputs = (model, inputs, endpoint) => ({
    ...model,
    provider: 'higgsfield',
    provider_name: 'Higgsfield',
    endpoint,
    inputs,
});

const qwenImage3 = findModels(catalog.t2iModels, ['qwen image 3', 'qwen3-text-to-image'])[0]
    || catalog.t2iModels.find((model) => model.id === 'qwen-image');
const seedance25 = findModels(catalog.t2vModels, ['seedance 2.5', 'seedance-2.5'])[0];
const minimaxH3 = findModels(catalog.t2vModels, ['minimax h3', 'minimax-h3'])[0];

export const t2iModels = qwenImage3 ? [withInputs(qwenImage3, {
    prompt: field('prompt', 'Prompt', 'string'),
    negative_prompt: field('negative_prompt', 'Negative Prompt', 'string'),
    resolution: field('resolution', 'Resolution', 'string', ['1k', '2k'], '1k'),
    aspect_ratio: field('aspect_ratio', 'Aspect Ratio', 'string', ['1:1', '2:3', '3:2', '3:4', '4:3', '7:9', '9:7', '9:16', '16:9', '21:9'], '1:1'),
    prompt_extend: field('prompt_extend', 'Enhance Prompt', 'boolean', null, true),
    enable_thinking: field('enable_thinking', 'Thinking Mode', 'boolean', null, true),
    prompt_extend_mode: field('prompt_extend_mode', 'Prompt Enhancement', 'string', ['direct', 'agent'], 'direct'),
    seed: field('seed', 'Seed', 'integer'),
}, 'alibaba/qwen-image-3/text-to-image')] : [];

const seedance25Model = seedance25 ? withInputs(seedance25, {
    prompt: field('prompt', 'Prompt', 'string'),
    duration: field('duration', 'Duration', 'integer', [4, 5, 8, 10, 15, 20, 25, 30], 5),
    resolution: field('resolution', 'Resolution', 'string', ['480p', '720p', '1080p'], '720p'),
    aspect_ratio: field('aspect_ratio', 'Aspect Ratio', 'string', ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], '16:9'),
    output_format: field('output_format', 'Output Format', 'string', ['mp4', 'mov'], 'mp4'),
    generate_audio: field('generate_audio', 'Generate Audio', 'boolean', null, true),
}, 'bytedance/seedance-2.5/text-to-video') : null;

const minimaxH3Model = minimaxH3 ? withInputs(minimaxH3, {
    prompt: field('prompt', 'Prompt', 'string'),
    duration: field('duration', 'Duration', 'integer', [5, 10, 15], 5),
    resolution: field('resolution', 'Resolution', 'string', ['2K'], '2K'),
    aspect_ratio: field('aspect_ratio', 'Aspect Ratio', 'string', ['auto', 'adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], 'auto'),
    aigc_watermark: field('aigc_watermark', 'AIGC Watermark', 'boolean', null, false),
}, 'minimax/h3/text-to-video') : null;

export const t2vModels = [seedance25Model, minimaxH3Model].filter(Boolean);
export const i2iModels = [];
export const i2vModels = [];
export const v2vModels = [];

const values = (models, id, fieldName, fallback) =>
    models.find((model) => model.id === id)?.inputs?.[fieldName]?.enum || fallback;
export const getAspectRatiosForModel = (id) => values(t2iModels, id, 'aspect_ratio', ['1:1']);
export const getResolutionsForModel = (id) => values(t2iModels, id, 'resolution', ['1k']);
export const getQualityFieldForModel = () => null;
export const getAspectRatiosForVideoModel = (id) => values(t2vModels, id, 'aspect_ratio', ['16:9']);
export const getDurationsForModel = (id) => values(t2vModels, id, 'duration', [5]);
export const getResolutionsForVideoModel = (id) => values(t2vModels, id, 'resolution', ['720p']);
export const getAspectRatiosForI2IModel = () => [];
export const getResolutionsForI2IModel = () => [];
export const getQualityFieldForI2IModel = () => null;
export const getMaxImagesForI2IModel = () => 0;
export const getEffectsForI2IModel = () => [];
export const getDefaultEffectForI2IModel = () => null;
export const getI2IModelById = () => null;

export * from './models.js';
