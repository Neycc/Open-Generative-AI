import { NextResponse } from 'next/server';

const HIGGSFIELD_BASE = 'https://api.higgsfield.ai';
const MODEL_PATHS = new Set([
    'bytedance/seedance-2.5/text-to-video',
    'minimax/h3/text-to-video',
    'alibaba/qwen-image-3/text-to-image',
]);
const REQUEST_ID = /^[a-zA-Z0-9_-]{1,160}$/;

function getPath(params) {
    return (params.path || []).join('/');
}

function getApiKey(request) {
    const authorization = request.headers.get('authorization') || '';
    if (authorization.startsWith('Key ')) return authorization.slice(4).trim();
    return '';
}

function isAllowed(method, path) {
    if (method === 'POST') return MODEL_PATHS.has(path) || path === 'files/generate-upload-url';
    if (method === 'GET') {
        const parts = path.split('/');
        return parts.length === 3 && parts[0] === 'requests' && parts[2] === 'status' && REQUEST_ID.test(parts[1]);
    }
    return false;
}

async function proxy(request, context) {
    const params = await context.params;
    const path = getPath(params);
    if (!isAllowed(request.method, path)) {
        return NextResponse.json({ error: 'Higgsfield endpoint is not enabled in this app.' }, { status: 404 });
    }
    const apiKey = getApiKey(request);
    if (!apiKey) return NextResponse.json({ error: 'Higgsfield API key is required.' }, { status: 401 });

    const headers = new Headers();
    headers.set('Authorization', `Key ${apiKey}`);
    if (request.method === 'POST') headers.set('Content-Type', 'application/json');

    try {
        const upstream = await fetch(`${HIGGSFIELD_BASE}/${path}`, {
            method: request.method,
            headers,
            ...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
            cache: 'no-store',
        });
        const body = await upstream.arrayBuffer();
        return new Response(body, {
            status: upstream.status,
            headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
        });
    } catch (error) {
        return NextResponse.json({ error: error?.message || 'Higgsfield request failed.' }, { status: 502 });
    }
}

export const GET = proxy;
export const POST = proxy;
