// scraper.js
const { chromium } = require("playwright");

let browser = null;
let context = null;

// Inizializza il browser UNA VOLTA SOLA e riusa il context
async function getContext() {
    if (context) return context;

    try {
        browser = await chromium.launch({ headless: true });
        global.browser = browser; // opzionale: lo rendo disponibile per uno shutdown esterno
        context = await browser.newContext({
            storageState: "./server/knowunity-session.json"
        });

        return context;
    } catch (err) {
        console.error("❌ [scraper] Errore in getContext:", err);
        throw err; // qui ha senso farlo fallire: senza browser non possiamo fare nulla
    }
}

// Funzione asincrona chiamabile dal server
async function scrapeKnowunity(noteUrl) {
    if (!noteUrl || typeof noteUrl !== "string") {
        console.error("❌ [scraper] URL non valido:", noteUrl);
        return [];
    }

    const ctx = await getContext();
    const page = await ctx.newPage();

    try {
        await page.goto(noteUrl, { waitUntil: "networkidle" });

        // Piccola attesa extra per sicurezza
        await page.waitForTimeout(500);

        let previewUrl = null;

        // 1° tentativo di estrarre la preview
        try {
            previewUrl = await page.evaluate(() => {
                try {
                    const regex = /https:\/\/content-eu-central-1\.knowunity\.com\/CONTENT\/[A-Za-z0-9_-]+_PREVIEW_SMALL\.webp/g;
                    const html = document.documentElement.innerHTML;
                    const matches = html.match(regex);
                    if (!matches || matches.length === 0) return null;
                    return matches[0];
                } catch (e) {
                    console.error("❌ [scraper/page] Errore dentro evaluate (primo tentativo):", e);
                    return null;
                }
            });
        } catch (err) {
            console.error("❌ [scraper] page.evaluate (primo tentativo) ha lanciato:", err);
        }

        // Se non troviamo nulla, riproviamo dopo un attimo
        if (!previewUrl) {
            await page.waitForTimeout(1000);

            try {
                previewUrl = await page.evaluate(() => {
                    try {
                        const regex = /https:\/\/content-eu-central-1\.knowunity\.com\/CONTENT\/[A-Za-z0-9_-]+_PREVIEW_SMALL\.webp/g;
                        const html = document.documentElement.innerHTML;
                        const matches = html.match(regex);
                        if (!matches || matches.length === 0) return null;
                        return matches[0];
                    } catch (e) {
                        console.error("❌ [scraper/page] Errore dentro evaluate (secondo tentativo):", e);
                        return null;
                    }
                });
            } catch (err) {
                console.error("❌ [scraper] page.evaluate (secondo tentativo) ha lanciato:", err);
            }
        }

        if (!previewUrl) return [];

        // 2) Costruiamo le immagini ad alta risoluzione
        const base = previewUrl.replace("PREVIEW_SMALL.webp", "");

        const images = [];

        for (let i = 1; i <= 50; i++) { // limite massimo 50 pagine
            const url = `${base}image_page_${i}.webp`;

            try {
                // Node 22 ha fetch globale
                const res = await fetch(url, { method: "HEAD" });

                if (!res.ok) break;

                images.push(url);
            } catch (err) {
                console.error(`❌ [scraper] Errore durante la HEAD per pagina ${i}:`, err);
                break;
            }
        }

        return images;
    } catch (err) {
        console.error("❌ [scraper] Errore top-level in scrapeKnowunity:", err);
        return [];
    } finally {
        try {
            await page.close();
        } catch (err) {
            console.error("⚠️ [scraper] Errore chiudendo la page:", err);
        }
    }
}

module.exports = {
    scrapeKnowunity
};
