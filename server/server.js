const http = require("http");
const path = require("path");
const fs = require("fs");
const session = require("./session");
const { scrapeKnowunity } = require("../src/knowunityScraper")
const { webpToPdf } = require("../src/imageConverter")

const HOSTNAME = "127.0.0.1";
const PORT = 5000;
const MIMETYPES = {
    '.html': 'text/html',      // File HTML
    '.css': 'text/css',        // Fogli di stile CSS
    '.js': 'text/javascript',  // File JavaScript
    '.ico': 'image/x-icon'     // Icone del sito
};
const ALLOWED_PATHS = {
    '/': '../client/index.html',
    '/download.pdf': '/download.pdf',
    '/styles/style.css': '../client/styles/style.css',
    '/scripts/client.js': '../client/scripts/client.js',
    '/assets/kitty.ico': '../client/assets/kitty.ico',
    '/assets/kitty.png': '../client/assets/kitty.png'
};

function serveFile(res, filePath) {
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIMETYPES[extname] || "application/octet-stream";

    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => resolve(body));
    });
}

async function handleInput(req, res, userSession) {
    const body = await parseBody(req);
    const input = new URLSearchParams(body).get("KnowUnityLink");
    if (!input) {
        sendError(res, 1);
        return;
    }

    let link;
    try {
        link = new URL(input);
    }
    catch (err) {
        sendError(res, 1);
        return;
    }

    if (!link.hostname.includes("knowunity") || !link.pathname.startsWith("/knows/")) {
        sendError(res, 1);
        return;
    }

    let photos;
    try {
        photos = await scrapeKnowunity(link.toString());
    }
    catch (err) {
        if (err.name.toLowerCase() === "timeouterror")
            sendError(res, 2);
        else
            sendError(res, 4);
        return;
    }

    if (!photos || photos.length === 0) {
        sendError(res, 3);
        return;
    }
    userSession.data.lastPhotos = photos;
    res.writeHead(302, { "Location": "/?success=1" });
    res.end();
}

function sendError(res, err) {
    res.writeHead(302, { "Location": `/?error=${err}` });
    res.end();
}

async function sendPDF(res, userSession) {
    const photos = userSession.data.lastPhotos;
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
        sendError(res, 3);
        return;
    }

    let pdf;
    try {
        pdf = await webpToPdf(photos);
    } catch (err) {
        sendError(res, 4);
        return;
    }

    res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="note.pdf"'
    });
    res.end(pdf);
}

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${HOSTNAME}`)
    const method = req.method

    // 1) Provo a leggere la sessione esistente
    let userSession = session.getSession(req);

    // 2) Se non esiste, la creo
    if (!userSession) {
        userSession = session.createSession();
        const cookieHeader = session.buildCookie(userSession.sid);
        res.setHeader("Set-Cookie", cookieHeader);
    }

    if (ALLOWED_PATHS[url.pathname]) {
        if (method === "GET") {
            if (url.pathname === "/download.pdf")
                await sendPDF(res, userSession);
            else
                serveFile(res, path.join(__dirname, ALLOWED_PATHS[url.pathname]));
        }
        else if (method === "POST" && url.pathname === "/")
            await handleInput(req, res, userSession);
    }
}

setInterval(session.cleanSessions, session.REFRESH_TIME);
const SERVER = http.createServer(handleRequest);
SERVER.listen(PORT, HOSTNAME, ()=>console.log("✅ server attivo"));


// Gestione shutdown pulito
process.on("SIGINT", async () => {
    console.log("\n🔴 Arresto in corso...");

    SERVER.close(() => {
        console.log("🟢 Server HTTP chiuso");
        process.exit(0);
    });
});
