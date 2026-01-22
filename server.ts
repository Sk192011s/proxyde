import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { html } from "npm:hono@4/html";
const app = new Hono();
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD'],
    exposeHeaders: ['Content-Length', 'Content-Range', 'Content-Type', 'ETag', 'Accept-Ranges']
}));
const ALLOWED_DOMAINS = [
    "pub-9c8bcd6f32434fe08628852555cc2e5c.r2.dev",
    "pub-cbf23f7a9f914d1a88f8f1cf741716db.r2.dev",
    "pub-45c2fb2299a2438ea38ae56d17f3078e.r2.dev",
    "pub-50fdd8fdb8474becb9427139f00206ad.r2.dev",
    "lugyi-application-stream.deno.dev"
];
app.get("/ping", (c) => c.text("pong"));
app.on(['GET', 'HEAD'], "/stream", async (c) => {
    const targetUrl = c.req.query("url");
    if (!targetUrl) return c.text("URL Required", 400);
    try {
        const parsedUrl = new URL(targetUrl);
        if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
            return c.text("⛔ Access Denied: This domain is not allowed.", 403);
        }
        const requestHeaders = new Headers();
        requestHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        const range = c.req.header("range");
        if (range) requestHeaders.set("Range", range);
        const response = await fetch(targetUrl, {
            method: c.req.method,
            headers: requestHeaders,
        });
        if (!response.ok) return c.text("Source Error", response.status as any);
        const newHeaders = new Headers();
        const headersToKeep = [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "last-modified",
            "etag"
        ];
        headersToKeep.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                newHeaders.set(header, value);
            }
        });
        if (!newHeaders.has("content-type")) {
            newHeaders.set("content-type", "video/mp4");
        }
        newHeaders.set("Cache-Control", "public, max-age=3600");
        return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
        });
    } catch (e: any) {
        return c.text("Invalid URL or Error: " + e.message, 400);
    }
});
app.get("/", (c) => c.html(html`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R2 Link Generator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>body{background:#09090b; color:white; font-family: sans-serif;}</style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen p-4">
    <div class="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div class="text-center mb-8">
            <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <i class="fa-solid fa-link text-2xl text-blue-500"></i>
            </div>
            <h1 class="text-2xl font-bold text-white">R2 Proxy Generator</h1>
            <p class="text-zinc-500 text-sm mt-2">Generate high-speed streaming links for your R2 storage.</p>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block text-xs text-zinc-400 mb-1 ml-1">Original R2 Link</label>
                <div class="relative">
                    <i class="fa-solid fa-globe absolute left-4 top-3.5 text-zinc-500"></i>
                    <input type="url" id="inputUrl" placeholder="https://pub-xxxx.r2.dev/video.mp4" 
                        class="w-full bg-black border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition">
                </div>
            </div>
            <button onclick="generateLink()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/20">
                Generate Proxy Link
            </button>
        </div>
        <div id="resultArea" class="hidden mt-6 pt-6 border-t border-zinc-800">
            <label class="block text-xs text-green-500 mb-2 ml-1 font-bold">
                <i class="fa-solid fa-check-circle mr-1"></i> Generated Successfully
            </label>
            <div class="relative group">
                <div class="bg-black border border-green-900/50 rounded-xl p-4 pr-12 break-all text-sm text-zinc-300 font-mono" id="outputUrl"></div>
                <button onclick="copyLink()" class="absolute right-2 top-2 p-2 text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition" title="Copy">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>
            <p class="text-[10px] text-zinc-600 mt-2 text-center">Use this link in your player or app.</p>
        </div>
    </div>
    <div id="toast" class="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-2 rounded-full shadow-lg transform translate-y-20 opacity-0 transition-all duration-300 text-sm font-bold">
        Link Copied!
    </div>
    <script>
        function generateLink() {
            const input = document.getElementById('inputUrl').value.trim();
            if (!input) return alert("Please enter a URL");
            try {
                new URL(input);
            } catch {
                alert("Valid URL required!");
                return;
            }
            const proxyLink = window.location.origin + "/stream?url=" + encodeURIComponent(input);
            document.getElementById('resultArea').classList.remove('hidden');
            document.getElementById('outputUrl').innerText = proxyLink;
        }
        function copyLink() {
            const text = document.getElementById('outputUrl').innerText;
            navigator.clipboard.writeText(text).then(() => {
                showToast();
            });
        }
        function showToast() {
            const toast = document.getElementById('toast');
            toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 2000);
        }
    </script>
</body>
</html>
`));
Deno.serve(app.fetch);
