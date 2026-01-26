const express = require("express");
const path = require("path");

const session = require("./session");
const { scrapeKnowunity } = require("../src/knowunityScraper");
const { webpToPdf } = require("../src/imageConverter");

const HOSTNAME = "127.0.0.1";
const PORT = 5000;

const app = express();

/* ===========================
   Middleware globali
=========================== */
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    let userSession = session.getSession(req);

    if (!userSession) {
        userSession = session.createSession();
        const cookieHeader = session.buildCookie(userSession.sid);
        res.setHeader("Set-Cookie", cookieHeader);
    }

    req.session = userSession;
    next();
});

/* ===========================
   Static files
=========================== */

app.use("/styles", express.static(path.join(__dirname, "../client/styles")));
app.use("/scripts", express.static(path.join(__dirname, "../client/scripts")));
app.use("/assets", express.static(path.join(__dirname, "../client/assets")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../client/index.html")));

// Handle form submit
app.post("/", async (req, res) => {
    const input = req.body.KnowUnityLink;

    if (!input) 
        return res.redirect("/?error=1");
    

    let link;
    try {
        link = new URL(input);
    }
    catch {
        return res.redirect("/?error=1");
    }

    if (!link.hostname.includes("knowunity") || !link.pathname.startsWith("/knows/")) 
        return res.redirect("/?error=1");
    
    let photos;
    try {
        photos = await scrapeKnowunity(link.toString());
    }
    catch (err) {
        if (err.name?.toLowerCase() === "timeouterror")
            return res.redirect("/?error=2");
        return res.redirect("/?error=4");
    }

    if (!photos || photos.length === 0) {
        return res.redirect("/?error=3");
    }

    req.session.data.lastPhotos = photos;
    res.redirect("/?success=1");
});

// Download PDF
app.get("/download.pdf", async (req, res) => {
    const photos = req.session.data.lastPhotos;

    if (!photos || !Array.isArray(photos) || photos.length === 0)
        return res.redirect("/?error=3");
    
    let pdf;
    try {
        pdf = await webpToPdf(photos);
    }
    catch {
        return res.redirect("/?error=4");
    }

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="note.pdf"'
    });

    res.send(pdf);
});


const server = app.listen(PORT, HOSTNAME, () => {
    console.log("✅ server attivo");
});

/* ===========================
   Shutdown pulito
=========================== */

process.on("SIGINT", () => {
    console.log("\n🔴 Arresto in corso...");

    server.close(() => {
        console.log("🟢 Server HTTP chiuso");
        process.exit(0);
    });
});
