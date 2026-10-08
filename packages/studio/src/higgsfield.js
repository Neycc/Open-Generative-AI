import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getRecastModelById, getLipSyncModelById, getAudioModelById, getMotionControlModelById } from './models.js';
import {
    buildVideoToolPayload,
    serializeVideoToolOptions,
} from './videoToolCapabilities.js';
import { buildImageSizePayload } from './imageSizing.js';
import { buildImageInputPayload, getImageInputValidationError, normalizePrimaryImageUrls } from './imageInputContracts.js';
import { pollForGenerationResult } from './utils/generationLifecycle.js';
import { getModelMediaCapabilities, mapReferenceParams } from './modelCapabilities.js';
import { buildSupplementalInputPayload } from './modelParameters.js';
import { getGroupedVideoConfiguration } from './groupedVideoModels.js';

// Browser requests go through the app proxy; Electron can call Higgsfield directly.
const BASE_URL = (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http'))
    ? '/api/higgsfield'
    : 'https://api.higgsfield.ai';
const FILE_UPLOAD_TIMEOUT_MS = 300_000;
const FILE_UPLOAD_PENDING_PROGRESS = 99;

const HIGGSFIELD_ENDPOINTS = {
    'seedance-2.5': 'bytedance/seedance-2.5/text-to-video',
    'seedance-2.5-text-to-video': 'bytedance/seedance-2.5/text-to-video',
    'bytedance-seedance-2.5-text-to-video': 'bytedance/seedance-2.5/text-to-video',
    'minimax-h3': 'minimax/h3/text-to-video',
    'minimax-h3-text-to-video': 'minimax/h3/text-to-video',
    'qwen-image-3': 'alibaba/qwen-image-3/text-to-image',
    'qwen3-text-to-image': 'alibaba/qwen-image-3/text-to-image',
    'qwen-image-3-text-to-image': 'alibaba/qwen-image-3/text-to-image',
};

function resolveHiggsfieldEndpoint(endpoint) {
    const normalized = String(endpoint || '').trim().replace(/^\/+|\/+$/g, '');
    const mapped = HIGGSFIELD_ENDPOINTS[normalized.toLowerCase()];
    if (mapped) return mapped;
    const knownPaths = [
        'bytedance/seedance-2.5/text-to-video',
        'minimax/h3/text-to-video',
        'alibaba/qwen-image-3/text-to-image',
    ];
    if (knownPaths.includes(normalized)) return normalized;
    throw new Error('This model is not mapped to a verified Higgsfield API endpoint yet.');
}

function buildHiggsfieldPayload(endpoint, payload) {
    const allowedFields = endpoint === 'bytedance/seedance-2.5/text-to-video'
        ? ['prompt', 'duration', 'resolution', 'aspect_ratio', 'bitrate_mode', 'output_format', 'generate_audio']
        : endpoint === 'minimax/h3/text-to-video'
            ? ['prompt', 'duration', 'resolution', 'aspect_ratio', 'aigc_watermark']
            : ['prompt', 'negative_prompt', 'resolution', 'aspect_ratio', 'prompt_extend', 'enable_thinking', 'prompt_extend_mode', 'seed'];
    const result = {};
    for (const field of allowedFields) {
        if (payload[field] !== undefined && payload[field] !== null) result[field] = payload[field];
    }
    if (!String(result.prompt || '').trim()) throw new Error('A prompt is required for Higgsfield generation.');
    for (const field of ['image_url', 'images_list', 'video_url', 'videos_list', 'video_files']) {
        if (payload[field]) throw new Error('This Higgsfield model does not accept uploaded reference media through this workflow yet.');
    }
    return result;
}

function notifyAuthRequired(status, detail) {
    if (typeof window === 'undefined') return;
    if (status !== 401 && status !== 403) return;
    window.dispatchEvent(new CustomEvent('higgsfield:auth-required', { detail: { status, message: detail } }));
}

function assertRequiredPrompt(model, params) {
    if (model?.promptRequired && !String(params.prompt || '').trim()) {
        throw new Error('Prompt is required for this model.');
    }
}

function includeRequiredArrayDefaults(model, payload) {
    const defaults = {};
    for (const field of model?.required || []) {
        if (payload[field] !== undefined || model?.inputs?.[field]?.type !== 'array') continue;
        defaults[field] = [];
    }
    return Object.keys(defaults).length > 0 ? { ...defaults, ...payload } : payload;
}

async function pollForResult(requestId, key, maxAttempts = 900, interval = 2000) {
    return pollForGenerationResult({
        baseUrl: BASE_URL,
        requestId,
        apiKey: key,
        maxAttempts,
        interval,
        onAuthRequired: notifyAuthRequired,
    });
}

function normalizePredictionResult(submitData, result, outputUrl) {
    const requestId = submitData?.request_id || submitData?.id || result?.request_id || result?.id;
    return {
        ...result,
        ...(requestId ? { request_id: requestId } : {}),
        url: outputUrl,
    };
}

async function submitAndPoll(endpointValue, payload, key, onRequestId, maxAttempts = 60) {
    const endpoint = resolveHiggsfieldEndpoint(endpointValue);
    const url = `${BASE_URL}/${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${key}` },
        body: JSON.stringify(buildHiggsfieldPayload(endpoint, payload))
    });
    if (!response.ok) {
        const errText = await response.text();
        notifyAuthRequired(response.status, errText);
        throw new Error(`Higgsfield API request failed: ${response.status} ${response.statusText} - ${errText.slice(0, 200)}`);
    }
    const submitData = await response.json();
    const requestId = submitData.request_id || submitData.id;
    if (!requestId) return submitData;
    if (onRequestId) onRequestId(requestId);
    const result = await pollForResult(requestId, key, maxAttempts);
    const outputUrl = result.video?.url || result.images?.[0]?.url || result.outputs?.[0] || result.url || result.output?.url;
    return normalizePredictionResult(submitData, result, outputUrl);
}

export async function generateImage(apiKey, params) {
    const modelInfo = getModelById(params.model);
    const endpoint = params.model || modelInfo?.endpoint;
    const payload = {
        ...buildSupplementalInputPayload(modelInfo, params),
        prompt: params.prompt
    };
    if (modelInfo) Object.assign(payload, buildImageSizePayload(modelInfo, params.aspect_ratio));
    else if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
    if (params.resolution) payload.resolution = params.resolution;
    if (params.quality) payload.quality = params.quality;
    if (params.image_url) { 
        payload.image_url = params.image_url; 
        payload.strength = params.strength || 0.6; 
    } else if (params.images_list) {
        payload.images_list = params.images_list;
    } else {
        payload.image_url = null;
    }
    if (params.seed && params.seed !== -1) payload.seed = params.seed;
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 60);
}

export async function generateI2I(apiKey, params) {
    const modelInfo = getI2IModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const imageField = modelInfo?.imageField || 'image_url';
    const imagesList = normalizePrimaryImageUrls(params.images_list, params.image_url);
    const inputError = getImageInputValidationError(modelInfo, 'i2i', {
        prompt: params.prompt,
        primaryImageUrls: imagesList,
        auxiliaryImageUrls: params,
    });
    if (inputError) throw new Error(inputError);
    const payload = {
        ...mapReferenceParams(modelInfo, params),
        ...buildSupplementalInputPayload(modelInfo, params),
        ...buildImageInputPayload(modelInfo, 'i2i', params)
    };
    if (imagesList.length > 0) {
        if (imageField === 'images_list') payload.images_list = imagesList;
        else payload[imageField] = imagesList[0];
    }
    if (modelInfo) Object.assign(payload, buildImageSizePayload(modelInfo, params.aspect_ratio));
    else if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
    if (params.resolution) payload.resolution = params.resolution;
    if (params.quality) payload.quality = params.quality;
    if (modelInfo?.inputs?.name) {
        payload.name = params.name || modelInfo.inputs.name.default;
    }
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 60);
}

export async function decomposeLayers(apiKey, params) {
    const endpoint = 'bytedance-seedream-5.0-pro-layer';
    const payload = {
        image_url: params.image_url,
        prompt: params.prompt || '',
        resolution: params.resolution || 'auto',
        output_format: params.output_format || 'png'
    };
    const result = await submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 300);
    const rawImages = result.images || result.output?.images || result.outputs || (result.url ? [result.url] : []);
    const images = Array.isArray(rawImages) ? rawImages : [rawImages];
    return { ...result, images };
}

export async function generateVideo(apiKey, params) {
    const modelInfo = getVideoModelById(params.model);
    const endpoint = params.model || modelInfo?.endpoint;
    const mediaCapabilities = getModelMediaCapabilities(modelInfo);
    assertRequiredPrompt(modelInfo, params);
    let payload = {
        ...mapReferenceParams(modelInfo, params),
        ...buildSupplementalInputPayload(modelInfo, params)
    };
    if (params.prompt) payload.prompt = params.prompt;
    if (params.request_id) payload.request_id = params.request_id;
    if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
    if (params.duration) payload.duration = params.duration;
    if (params.resolution) payload.resolution = params.resolution;
    if (typeof params.generate_audio === 'boolean') payload.generate_audio = params.generate_audio;
    if (params.quality) payload.quality = params.quality;
    if (params.mode) payload.mode = params.mode;
    if (!mediaCapabilities.image.field && params.image_url) payload.image_url = params.image_url;
    if (!mediaCapabilities.image.field && params.images_list?.length > 0) payload.images_list = params.images_list;
    if (!mediaCapabilities.video.field && params.videos_list?.length > 0) payload.videos_list = params.videos_list;
    if (!mediaCapabilities.video.field && params.video_files?.length > 0) payload.video_files = params.video_files;
    Object.assign(payload, serializeVideoToolOptions(modelInfo, params.options));
    payload = includeRequiredArrayDefaults(modelInfo, payload);
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function generateI2V(apiKey, params) {
    const modelInfo = getI2VModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    assertRequiredPrompt(modelInfo, params);
    let payload = {
        ...mapReferenceParams(modelInfo, params),
        ...buildSupplementalInputPayload(modelInfo, params)
    };
    if (params.prompt) payload.prompt = params.prompt;
    if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
    if (params.duration) payload.duration = params.duration;
    if (params.resolution) payload.resolution = params.resolution;
    if (typeof params.generate_audio === 'boolean') payload.generate_audio = params.generate_audio;
    if (params.quality) payload.quality = params.quality;
    if (params.mode) payload.mode = params.mode;
    if (modelInfo?.inputs?.name) {
        payload.name = params.name || modelInfo.inputs.name.default;
    }
    payload = includeRequiredArrayDefaults(modelInfo, payload);
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function generateMarketingStudioAd(apiKey, params) {
    const endpoint = params.resolution === '1080p' ? 'sd-2-vip-omni-reference-1080p' : 'seedance-2-vip-omni-reference';
    const payload = {
        prompt: params.prompt,
        aspect_ratio: params.aspect_ratio || '16:9',
        duration: params.duration || 5,
        images_list: params.images_list || [],
        video_files: params.video_files || []
    };
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function processV2V(apiKey, params) {
    const modelInfo = getV2VModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const toolPayload = buildVideoToolPayload(modelInfo, params);
    let payload = {
        ...buildSupplementalInputPayload(modelInfo, params),
        ...toolPayload,
        ...mapReferenceParams(modelInfo, params),
    };
    if (modelInfo?.hasPrompt && params.prompt) {
        payload.prompt = params.prompt;
    }
    if (getGroupedVideoConfiguration(modelInfo?.id)) {
        for (const field of ['duration', 'aspect_ratio', 'resolution', 'quality']) {
            if (modelInfo.inputs?.[field] && params[field] !== undefined) {
                payload[field] = params[field];
            }
        }
    }
    payload = includeRequiredArrayDefaults(modelInfo, payload);
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function estimateV2VCost() {
    throw new Error('Cost estimates are not available from the configured Higgsfield endpoints.');
}

export async function processRecast(apiKey, params) {
    const modelInfo = getRecastModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const videoField = modelInfo?.videoField || 'video_url';
    const payload = { [videoField]: params.video_url };
    if (modelInfo?.imageField && params.image_url) {
        payload[modelInfo.imageField] = params.image_url;
    }
    if (modelInfo?.hasPrompt && params.prompt) {
        payload.prompt = params.prompt;
    }
    if (params.aspect_ratio) {
        payload.aspect_ratio = params.aspect_ratio;
    }
    if (params.character_orientation) {
        payload.character_orientation = params.character_orientation;
    }
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function processMotionControl(apiKey, params) {
    const model = params.model || 'seedance-2.5-motion-control';
    const mode = params.mode || 'motion_transfer';
    const internalPrompt = mode === 'objects_swap'
        ? "Keep the rest of the scene as filmed, swap the characters, products, or clothes with the reference images."
        : "Extract motion from the reference video and rebuild the scene with the new characters and assets, preserving the original motion, choreography, and camera movements.";

    const userPrompt = String(params.prompt || '').trim();
    const finalPrompt = userPrompt ? `${internalPrompt} ${userPrompt}` : internalPrompt;

    let imagesList = [];
    if (Array.isArray(params.images_list)) {
        imagesList = params.images_list;
    } else if (params.images) {
        imagesList = Array.isArray(params.images) ? params.images : [params.images];
    } else if (params.image_url) {
        imagesList = [params.image_url];
    }

    let duration = Number(params.duration) || 5;

    const payload = {
        video_url: params.video_url,
        images_list: imagesList,
        aspect_ratio: params.aspect_ratio || '16:9',
        duration: duration,
        generate_audio: !!params.generate_audio,
        prompt: finalPrompt
    };

    if (model === 'seedance-2-motion-control') {
        if (payload.duration > 15) payload.duration = 15;
        if (payload.duration < 4) payload.duration = 4;
        if (payload.images_list.length > 9) payload.images_list = payload.images_list.slice(0, 9);
        payload.quality = params.quality === 'basic' ? 'basic' : 'high';
        if (params.seed !== undefined && params.seed !== -1) payload.seed = Number(params.seed);
    } else {
        if (payload.duration > 30) payload.duration = 30;
        if (payload.duration < 4) payload.duration = 4;
        if (payload.images_list.length > 30) payload.images_list = payload.images_list.slice(0, 30);
        payload.high_bitrate = !!params.high_bitrate;
        if (params.seed !== undefined && params.seed !== -1) payload.seed = Number(params.seed);
    }

    return submitAndPoll(model, payload, apiKey, params.onRequestId, 900);
}

export async function processLipSync(apiKey, params) {
    const modelInfo = getLipSyncModelById(params.model);
    const endpoint = modelInfo?.endpoint || params.model;
    const payload = {};
    if (params.audio_url) payload.audio_url = params.audio_url;
    if (params.image_url) payload.image_url = params.image_url;
    if (params.video_url) payload.video_url = params.video_url;
    if (modelInfo?.hasPrompt) payload.prompt = params.prompt || '';
    if (params.resolution) payload.resolution = params.resolution;
    if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function generateAudio(apiKey, params) {
    const modelId = params._modelId || params.model;
    const modelInfo = getAudioModelById(modelId);
    const endpoint = modelInfo?.endpoint || modelId;
    const payload = {};
    const skipKeys = ['_modelId', 'onRequestId'];
    for (const key in params) {
        if (!skipKeys.includes(key) && params[key] !== undefined && params[key] !== null) {
            payload[key] = params[key];
        }
    }
    return submitAndPoll(endpoint, payload, apiKey, params.onRequestId, 900);
}

export async function uploadFile(apiKey, file, onProgress) {
    const response = await fetch(`${BASE_URL}/files/generate-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
        body: JSON.stringify({ content_type: file.type || 'application/octet-stream' })
    });
    if (!response.ok) throw new Error(`Higgsfield upload setup failed: ${response.status} ${await response.text()}`);
    const { upload_url: uploadUrl, upload_headers: uploadHeaders = {}, public_url: publicUrl } = await response.json();
    if (!uploadUrl || !publicUrl) throw new Error('Higgsfield did not return a signed upload URL and public URL.');

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        for (const [name, value] of Object.entries(uploadHeaders)) xhr.setRequestHeader(name, value);
        xhr.timeout = FILE_UPLOAD_TIMEOUT_MS;
        if (onProgress) xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(Math.min(Math.round(event.loaded / event.total * 100), FILE_UPLOAD_PENDING_PROGRESS));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Higgsfield file upload failed: ${xhr.status} ${xhr.statusText}`));
        xhr.onerror = () => reject(new Error('Network error during file upload'));
        xhr.ontimeout = () => reject(new Error('File upload timed out. Please try again.'));
        xhr.send(file);
    });
    onProgress?.(100);
    return publicUrl;
}

function higgsfieldFeatureUnavailable() {
    throw new Error('This feature is not available through the configured Higgsfield models yet.');
}

export async function getUserBalance(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getTemplateWorkflows(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getUserWorkflows(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getPublishedWorkflows(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getTemplateAgents(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getUserAgents(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getPublishedAgents(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getUserConversations(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getAgentBySlug(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getAgentConversation(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function sendAgentChatMessage(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function pollAgentChatResult(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function createAgent(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function createWorkflow(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function updateWorkflowName(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function deleteWorkflow(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getWorkflowInputs(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function executeWorkflow(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getAllNodeSchemas(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getWorkflowData(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getNodeSchemas(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function runSingleNode(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function deleteNodeRun(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getNodeStatus(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function handleProxyRequest(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function handleServerSideProxy(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function calculateDynamicCost(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function registerAppInterest(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getAppInterests(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function getHistory(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function deleteMedia(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function runClipping(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function runMotionGraphics(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function runMotionGraphicsEdit(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function upscaleImage(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function removeBackground(...args) {
    return higgsfieldFeatureUnavailable();
}

export async function expandImage(...args) {
    return higgsfieldFeatureUnavailable();
}
