import {
    generateImage as generateImageWithHiggsfield,
    generateVideo as generateVideoWithHiggsfield,
    generateI2I as generateI2IWithHiggsfield,
    generateI2V as generateI2VWithHiggsfield,
    processV2V as processV2VWithHiggsfield,
    processLipSync as processLipSyncWithHiggsfield,
    uploadFile as uploadFileWithHiggsfield,
} from '../../packages/studio/src/higgsfield.js';
import { pollForGenerationResult } from '../../packages/studio/src/utils/generationLifecycle.js';

if (typeof localStorage !== 'undefined') localStorage.removeItem('muapi_key');

export class HiggsfieldClient {
    getKey() {
        const key = window.__HIGGSFIELD_API_KEY__ || localStorage.getItem('higgsfield_api_key');
        if (!key) throw new Error('Higgsfield API key missing. Add it in Settings.');
        return key;
    }

    pollForResult(requestId, key, maxAttempts = 900, interval = 2000) {
        return pollForGenerationResult({
            baseUrl: (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) ? '/api/higgsfield' : 'https://api.higgsfield.ai',
            requestId,
            apiKey: key,
            maxAttempts,
            interval,
        });
    }
    generateImage(params) { return generateImageWithHiggsfield(this.getKey(), params); }
    generateVideo(params) { return generateVideoWithHiggsfield(this.getKey(), params); }
    generateI2I(params) { return generateI2IWithHiggsfield(this.getKey(), params); }
    generateI2V(params) { return generateI2VWithHiggsfield(this.getKey(), params); }
    processV2V(params) { return processV2VWithHiggsfield(this.getKey(), params); }
    processLipSync(params) { return processLipSyncWithHiggsfield(this.getKey(), params); }
    uploadFile(file, onProgress) { return uploadFileWithHiggsfield(this.getKey(), file, onProgress); }

    getDimensionsFromAR(ar) {
        switch (ar) {
            case '16:9': return [1280, 720];
            case '9:16': return [720, 1280];
            case '4:3': return [1152, 864];
            case '3:2': return [1216, 832];
            case '21:9': return [1536, 640];
            default: return [1024, 1024];
        }
    }
}

export const higgsfield = new HiggsfieldClient();
