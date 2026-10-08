# Open Generative AI

Open Generative AI is a self-hostable image and video generation studio. Cloud generation is connected to the official Higgsfield API; local inference options remain available in the desktop app.

## Higgsfield models currently enabled

The cloud model menu is limited to model endpoints with verified Higgsfield request schemas:

- **Qwen Image 3** — text to image
- **Seedance 2.5** — text to video
- **MiniMax H3** — text to video

Image, video, audio, workflow, and agent features that still depend on MuAPI-only endpoints are not exposed through the Higgsfield flow. Reference media uploads are also disabled until their Higgsfield request schemas are mapped.

## Configure your API key

1. Open **Settings** in the app.
2. Paste the complete Higgsfield API credential as provided by Higgsfield.
3. Save it, then choose a supported model and generate.

The app stores the key in browser storage and sends it to the app’s Higgsfield proxy for generation requests. Do not put API credentials in source files or commits.

Official references: [Higgsfield API](https://higgsfield.ai/higgsfield-api) · [API quick start](https://open.higgsfield.ai/quick-start)

## Run from source

Prerequisites: Node.js 18 or later.

```bash
git clone --recurse-submodules https://github.com/Anil-matcha/Open-Generative-AI.git
cd Open-Generative-AI
npm run setup
npm run dev
```

For the desktop app, use `npm run electron:dev`. Production builds use `npm run build`; desktop packaging scripts are listed in `package.json`.

## API lifecycle

The app sends JSON requests to the model-specific endpoint on `https://api.higgsfield.ai` with `Authorization: Key <credential>`. It polls `/requests/{request_id}/status` until a terminal result is returned. File uploads use Higgsfield’s signed upload URL flow; the API credential is not sent with the signed file transfer.

The main adapter and the allowlisted Next.js proxy live in:

- `packages/studio/src/higgsfield.js`
- `app/api/higgsfield/[[...path]]/route.js`

## License

MIT
