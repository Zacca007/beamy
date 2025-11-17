const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { scrapeKnowunity } = require("./src/scraper");
const { webpToPdf } = require("./src/converter");

const PORT = 8000;
const HOSTNAME = "pippizac.duckdns.org"; // usato solo come info/log

// MIME types per i file statici
const MIMETYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".ico": "image/x-icon"
};

// Limite corpo richieste POST (form con un URL → 10KB basta e avanza)
const MAX_BODY_SIZE = 10 * 1024; // 10 KiB

// Gestione sessioni
const SESSION = new Map();
const MAX_SESSIONS = 1000;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 ora

// Pulizia periodica delle sessioni vecchie
setInterval(() => {
    const now = Date.now();
    for (const [sid, data] of SESSION.entries()) {
        if (now - data.lastAccess > SESSION_TTL_MS) {
            SESSION.delete(sid);
        }
    }
}, 10 * 60 * 1000).unref(); // ogni 10 minuti, non blocca l'uscita del processo

function createSession() {
    return {
        lastPhotos: null,
        lastAccess: Date.now()
    };
}

// Restituisce l'oggetto sessione associato al cookie "sid", creandolo se manca
function getSession(req, res) {
    const cookieHeader = req.headers.cookie || "";
    let sid = null;

    cookieHeader.split(";").forEach(part => {
        const [key, value] = part.trim().split("=");
        if (key === "sid" && value) {
            sid = value;
        }
    });

    if (!sid || !SESSION.has(sid)) {
        // Limita il numero massimo di sessioni
        if (SESSION.size >= MAX_SESSIONS) {
            // Semplice strategia: elimina una sessione random (o la prima)
            const firstKey = SESSION.keys().next().value;
            if (firstKey) {
                SESSION.delete(firstKey);
            }
        }

        sid = crypto.randomBytes(16).toString("hex");
        SESSION.set(sid, createSession());

        // Cookie di sessione "blindato"
        // Con Caddy davanti in HTTPS, il browser vedrà https://... → Secure ok
        const cookie = [
            `sid=${sid}`,
            "HttpOnly",
            "Path=/",
            "SameSite=Lax",
            "Secure" // se in dev puro http, puoi toglierlo
        ].join("; ");

        res.setHeader("Set-Cookie", cookie);
    }

    const session = SESSION.get(sid);
    if (session) {
        session.lastAccess = Date.now();
    }

    return session;
}

// Serve un file statico in modo sicuro
function serveFile(res, filePath, code = 200, extraHeaders = {}) {
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIMETYPES[extname] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === "ENOENT") {
                res.writeHead(404, { "Content-Type": "text/html" });
                res.end("<h1>404 - File non trovato</h1>");
            } else {
                console.error("Errore leggendo file statico:", err);
                res.writeHead(500, { "Content-Type": "text/html" });
                res.end("<h1>500 - Errore interno del server</h1>");
            }
            return;
        }

        const headers = {
            "Content-Type": contentType,
            ...extraHeaders
        };
        res.writeHead(code, headers);
        res.end(data);
    });
}

// Legge il body di una richiesta con limite di dimensione
function parseBody(req, res, maxSize = MAX_BODY_SIZE) {
    return new Promise((resolve) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > maxSize) {
                if (!res.headersSent) {
                    res.writeHead(413, { "Content-Type": "text/plain" }); // Payload Too Large
                    res.end("Richiesta troppo grande");
                }
                req.destroy();
                resolve(null);
            }
        });

        req.on("end", () => {
            resolve(body);
        });

        req.on("error", (err) => {
            console.error("Errore durante la lettura del body:", err);
            if (!res.headersSent) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Errore nella richiesta");
            }
            resolve(null);
        });
    });
}

// Gestore principale richieste
async function handleRequest(req, res) {
    // try/catch globale per evitare crash del processo
    let pathname = "";
    try {
        const session = getSession(req, res);
        const method = req.method || "GET";
        const urlObj = new URL(req.url, "http://localhost");
        pathname = urlObj.pathname;

        // Home: GET pagina, POST form
        if (pathname === "/" || pathname === "/index.html") {
            if (method === "GET") {
                const homePath = path.join(__dirname, "../public", "index.html");
                serveFile(res, homePath);
                return;
            }

            if (method === "POST") {
                const body = await parseBody(req, res);
                if (body === null) {
                    // parseBody ha già risposto con errore
                    return;
                }

                try {
                    const form = new URLSearchParams(body);
                    let noteUrl = form.get("KnowUnityLink");

                    if (!noteUrl) {
                        res.writeHead(302, { "Location": "/?error=1" }); // invalid URL
                        res.end();
                        return;
                    }

                    // Validazione URL
                    let parsed;
                    try {
                        parsed = new URL(noteUrl);
                    } catch {
                        res.writeHead(302, { "Location": "/?error=1" });
                        res.end();
                        return;
                    }

                    // Restrizione dominio (evita SSRF a caso)
                    if (!parsed.hostname.includes("knowunity")) {
                        res.writeHead(302, { "Location": "/?error=1" });
                        res.end();
                        return;
                    }

                    noteUrl = parsed.toString();

                    const photos = await scrapeKnowunity(noteUrl);

                    if (!photos || photos.length === 0) {
                        res.writeHead(302, { "Location": "/?error=1" }); // invalid URL / nessuna foto
                        res.end();
                    } else {
                        session.lastPhotos = photos;
                        res.writeHead(302, { "Location": "/?success=1" });
                        res.end();
                    }

                } catch (err) {
                    console.error("Errore durante lo scraping:", err);
                    if (err && err.name === "TimeoutError") {
                        res.writeHead(302, { "Location": "/?error=2" }); // timeout
                    } else {
                        res.writeHead(302, { "Location": "/?error=3" }); // server error generico
                    }
                    res.end();
                }

                return;
            }

            // Metodo non supportato
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Metodo non supportato");
            return;
        }

        // File statici: /styles/... /scripts/... /assets/...
        if (pathname.startsWith("/styles/") || pathname.startsWith("/scripts/") || pathname.startsWith("/assets/")) {
            const publicRoot = path.join(__dirname, "../public");

            // rimuove leading slash per evitare che diventi percorso assoluto
            const relativePath = pathname.replace(/^\/+/, ""); // es: "styles/main.css"
            const filePath = path.join(publicRoot, relativePath);
            const normalizedPath = path.normalize(filePath);

            // deve rimanere sotto publicRoot
            const rootWithSep = publicRoot.endsWith(path.sep)
                ? publicRoot
                : publicRoot + path.sep;

            if (!normalizedPath.startsWith(rootWithSep)) {
                res.writeHead(403, { "Content-Type": "text/plain" });
                res.end("Forbidden");
                return;
            }

            serveFile(res, normalizedPath);
            return;
        }

        // Download PDF
        if (pathname === "/download.pdf" && method === "GET") {
            if (!session.lastPhotos || !Array.isArray(session.lastPhotos) || session.lastPhotos.length === 0) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Nessuna immagine da convertire");
                return;
            }

            try {
                const pdf = await webpToPdf(session.lastPhotos);

                res.writeHead(200, {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": 'attachment; filename="note.pdf"'
                });
                res.end(pdf);

            } catch (err) {
                console.error("Errore durante la conversione PDF:", err);
                res.writeHead(302, { "Location": "/?error=3" }); // errore server
                res.end();
            }

            return;
        }

        // 404 di default
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404 - Pagina non trovata</h1>");

    } catch (err) {
        console.error("Errore non gestito nella richiesta:", err);

        if (res.headersSent) {
            // se abbiamo già iniziato a rispondere, chiudiamo la connessione
            res.destroy();
            return;
        }

        // Se l'errore è su home, reindirizziamo con error=3 per mostrarlo lato client
        if (pathname === "/" || pathname === "/home.html") {
            res.writeHead(302, { "Location": "/?error=3" });
            res.end();
        } else {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Errore interno del server");
        }
    }
}

// Creazione server HTTP
const server = http.createServer(handleRequest);

// Ascolta solo su localhost, Caddy fa da reverse proxy verso di lui
server.listen(PORT, "127.0.0.1", () => {
    console.log(`✅ Server attivo su http://127.0.0.1:${PORT} (dietro Caddy per https://${HOSTNAME}/)`);
});

// Gestione shutdown pulito
process.on("SIGINT", async () => {
    console.log("\n🔴 Arresto in corso...");

    try {
        if (global.browser) {
            await global.browser.close();
            console.log("🧹 Browser Playwright chiuso");
        }
    } catch (err) {
        console.error("Errore chiudendo il browser:", err);
    }

    server.close(() => {
        console.log("🟢 Server HTTP chiuso");
        process.exit(0);
    });
});

// Ulteriore sicurezza: evita che eccezioni non gestite buttino giù il processo senza log
process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("unhandledRejection:", reason);
});
