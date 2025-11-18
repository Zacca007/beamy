const { randomBytes } = require("crypto");

const SESSIONS = new Map();
const MAX_SESSIONS = 10;
const MAX_AGE = 60 * 60 * 1000;    // 1h in millisecondi
const REFRESH_TIME = 10 * 60 * 1000; // 10 minuti

function createSession() {
    if (SESSIONS.size >= MAX_SESSIONS) {
        const firstKey = SESSIONS.keys().next().value;
        if (firstKey) SESSIONS.delete(firstKey);
    }

    const sid = randomBytes(16).toString("hex");
    const data = { lastPhotos: null, lastAccess: Date.now() };
    SESSIONS.set(sid, data);
    return { sid, data };
}

function cleanSessions() {
    const now = Date.now();

    for (const [sid, sessionData] of SESSIONS.entries()) {
        const age = now - sessionData.lastAccess;
        if (age > MAX_AGE) SESSIONS.delete(sid);
    }
}

function parseCookies(header) {
    const cookies = {};
    if (!header) return cookies;

    const parts = header.split(";");
    for (let i = 0; i < parts.length; i++) {
        const trimmedCookie = parts[i].trim();
        const eqIndex = trimmedCookie.indexOf("=");
        if (eqIndex === -1) continue;

        const key = trimmedCookie.substring(0, eqIndex);
        const value = trimmedCookie.substring(eqIndex + 1);
        cookies[key] = value;
    }

    return cookies;
}

function buildCookie(sid) {
    let cookie = "sid=" + sid;
    cookie += "; HttpOnly";
    cookie += "; Path=/";
    cookie += "; SameSite=Lax";
    cookie += "; Secure"; // togli se in dev sei in http
    return cookie;
}

function getSession(req) {
    const cookieHeader = req.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    const sid = cookies.sid;

    if (typeof sid !== "string" || !SESSIONS.has(sid))
        return null;

    const sessionData = SESSIONS.get(sid);
    sessionData.lastAccess = Date.now();
    return { sid, data: sessionData };
}

module.exports = {
    getSession,
    cleanSessions,
    buildCookie,
    createSession,
    REFRESH_TIME
};
