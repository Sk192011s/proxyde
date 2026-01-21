/** @jsxImportSource npm:hono@4/jsx */
import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { html } from "npm:hono@4/html";

const app = new Hono();

// 1. Enable CORS (Web Player/ App တွေကနေ လှမ်းယူလို့ရအောင်)
app.use('*', cors());

// ===========================
// MAIN PROXY LOGIC
// ===========================
app.get("/stream", async (c) => {
  const targetUrl = c.req.query("url");
  
  if (!targetUrl) {
    return c.text("Error: ?url=VIDEO_LINK ထည့်ပေးဖို့ လိုပါတယ်", 400);
  }

  try {
    // 2. Prepare Headers (Browser အစစ်ယောင်ဆောင်ခြင်း)
    // Video Server တွေက Bot လို့ထင်ရင် Block တတ်လို့ User-Agent ထည့်ပေးရပါတယ်
    const requestHeaders = new Headers();
    requestHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // 3. Handle Range Requests (Seeking အတွက် အသက်)
    // ရှေ့ကျော်/နောက်ကျော် လုပ်တဲ့အခါ Player က "Range: bytes=1000-" ဆိုပြီး လှမ်းတောင်းတတ်ပါတယ်
    // အဲ့ဒါကို Original Server ဆီ လက်ဆင့်ကမ်းပေးမှ Seeking လုပ်လို့ရမှာပါ
    const range = c.req.header("range");
    if (range) {
      requestHeaders.set("Range", range);
    }

    // 4. Fetch form Original Server
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: requestHeaders,
    });

    if (!response.ok) {
      return c.text(`Source Server Error: ${response.status} ${response.statusText}`, response.status as any);
    }

    // 5. Build Response Headers
    // Video ဖိုင်မှန်းသိအောင်နဲ့ ရှေ့ကျော်နောက်ကျော်ရအောင် Header တွေ ပြန်စီပါမယ်
    const newHeaders = new Headers();
    newHeaders.set("Access-Control-Allow-Origin", "*");
    
    // အရေးကြီးတဲ့ Header များ
    const contentType = response.headers.get("Content-Type");
    if (contentType) newHeaders.set("Content-Type", contentType);

    const contentLength = response.headers.get("Content-Length");
    if (contentLength) newHeaders.set("Content-Length", contentLength);

    const contentRange = response.headers.get("Content-Range");
    if (contentRange) newHeaders.set("Content-Range", contentRange);
    
    newHeaders.set("Accept-Ranges", "bytes"); // Seeking ရကြောင်း ကြေငြာခြင်း
    newHeaders.set("Cache-Control", "public, max-age=3600"); // Caching အနည်းငယ်ထားခြင်း

    // 6. Return Stream (Pipe)
    // response.body ကို တန်းပို့ပေးလိုက်တဲ့အတွက် Server မှာ ၀န်မပိဘဲ အရမ်းမြန်ပါတယ်
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });

  } catch (error: any) {
    return c.text("Proxy Error: " + error.message, 500);
  }
});

// ===========================
// TESTING UI (Player)
// ===========================
app.get("/", (c) => c.html(html`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream Proxy</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body{background:#0f0f10;color:white;}</style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen p-4">
    <div class="max-w-3xl w-full space-y-6">
        <h1 class="text-2xl font-bold text-green-500 text-center">🚀 Fast Stream Proxy Node</h1>
        
        <!-- Input Form -->
        <div class="flex gap-2">
            <input type="text" id="urlInput" placeholder="Enter original video URL (Blocked/Slow)..." 
                class="w-full bg-zinc-900 border border-zinc-700 p-3 rounded text-sm focus:border-green-500 outline-none">
            <button onclick="playVideo()" class="bg-green-600 px-6 rounded font-bold hover:bg-green-500">PLAY</button>
        </div>

        <!-- Video Player -->
        <div class="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative">
            <video id="player" controls class="w-full h-full" autoplay></video>
            <div id="placeholder" class="absolute inset-0 flex items-center justify-center text-zinc-600">
                Waiting for link...
            </div>
        </div>

        <!-- Generated Link -->
        <div class="bg-zinc-900 p-4 rounded border border-zinc-800 hidden" id="resultArea">
            <p class="text-xs text-zinc-400 mb-2">Proxy URL (Use this in your App):</p>
            <code id="proxyUrl" class="block bg-black p-3 rounded text-green-400 text-xs break-all cursor-pointer" onclick="copyLink()"></code>
        </div>
    </div>

    <script>
        function playVideo() {
            const originalUrl = document.getElementById('urlInput').value;
            if(!originalUrl) return alert("URL ထည့်ပါ");

            // Construct Proxy URL
            const proxyLink = window.location.origin + "/stream?url=" + encodeURIComponent(originalUrl);

            // Update Player
            const video = document.getElementById('player');
            video.src = proxyLink;
            document.getElementById('placeholder').style.display = 'none';
            
            // Show Result
            document.getElementById('resultArea').classList.remove('hidden');
            document.getElementById('proxyUrl').innerText = proxyLink;
        }

        function copyLink() {
            const text = document.getElementById('proxyUrl').innerText;
            navigator.clipboard.writeText(text);
            alert("Copied!");
        }
    </script>
</body>
</html>
`));

Deno.serve(app.fetch);
