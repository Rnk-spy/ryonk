/*
 * RYONK — konfigurasi.
 * JANGAN taruh API key rahasia di sini: file ini dikirim ke browser.
 * Arahkan endpoint ke proxy/serverless milik Anda (Cloudflare Worker,
 * Vercel, dsb.) yang menyimpan key di sisi server.
 *
 * Kontrak endpoint (semua POST, JSON):
 *   chatEndpoint  : { model, mode, system, messages:[{role,content}] } -> { reply: "teks" }
 *   imageEndpoint : { prompt, size }                                   -> { url: "https://..." } atau { b64: "..." }
 *   mediaEndpoint : { url }                                            -> { downloadUrl: "https://..." }
 * Kosongkan endpoint = mode demo (UI jalan, tidak ada AI sungguhan).
 */
const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const chatEndpoints = {
  development: "http://127.0.0.1:8787/api/chat",
  production: "https://ryonk-chat-api-production.ryonk.workers.dev/api/chat"
};

window.ryonkTurnstileLoaded = false;
window.ryonkTurnstileReady = () => {
  window.ryonkTurnstileLoaded = true;
  window.dispatchEvent(new Event("ryonk-turnstile-ready"));
};

window.RYONK_CONFIG = {
  appName: "RYONK",
  tagline: "Intelligence meets creativity.",
  isLocalDevelopment,
  turnstileSiteKey: isLocalDevelopment ? "0x4AAAAAAGDSl1YOJTaqnAQH" : "0x4AAAAAAGDRBjZgos_fIYPD",
  api: {
    chatEndpoint: isLocalDevelopment ? chatEndpoints.development : chatEndpoints.production,
    turnstileCheckEndpoint: isLocalDevelopment ? "http://127.0.0.1:8787/api/turnstile-check" : "",
    chatUnavailableReason: isLocalDevelopment ? "" : "URL Worker production belum dikonfigurasi",
    imageEndpoint: "",
    mediaEndpoint: "",
    timeoutMs: 60000
  },
  models: [
    { id: "ryonk-fast", label: "Fast" },
    { id: "ryonk-balanced", label: "Balanced" },
    { id: "ryonk-deep", label: "Deep reasoning" }
  ],
  modes: [
    { id: "chat", label: "Chat" },
    { id: "analysis", label: "Analisis file" },
    { id: "code", label: "Coding" },
    { id: "write", label: "Menulis" }
  ],
  defaultSystemPrompt:
    "Kamu adalah asisten RYONK. Jawab dengan jelas, ringkas, dan jujur. Gunakan bahasa yang dipakai pengguna."
};
