// scraper.js
const { chromium } = require("playwright");

let browser = null;
let context = null;

// Inizializza il browser UNA VOLTA SOLA e riusa il context
async function getContext() {
    if (context) return context;

    try {
        console.log("========== [scraper] Inizializzazione browser/context ==========");
        browser = await chromium.launch({ headless: true });
        // opzionale: lo rendo disponibile per uno shutdown esterno
        global.browser = browser;

        context = await browser.newContext({
            storageState: "knowunity-session.json"  // 👈 usa la sessione salvata
        });

        console.log("[scraper] Browser e context inizializzati");
        return context;
    } catch (err) {
        console.error("❌ [scraper] Errore in getContext:", err);
        throw err; // qui ha senso farlo fallire: senza browser non possiamo fare nulla
    }
}

// Funzione asincrona chiamabile dal server
async function scrapeKnowunity(noteUrl) {
    console.log("\n========== [scraper] Nuovo scraping ==========");
    console.log("[scraper] URL ricevuto:", noteUrl);

    if (!noteUrl || typeof noteUrl !== "string") {
        console.error("❌ [scraper] URL non valido:", noteUrl);
        return [];
    }

    const ctx = await getContext();
    const page = await ctx.newPage();
    console.log("[scraper] Nuova page creata");

    try {
        // Navigazione
        console.log("[scraper] Navigazione verso la nota...");
        await page.goto(noteUrl, { waitUntil: "networkidle" });
        console.log("[scraper] Navigazione completata (networkidle)");

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
            console.warn("⚠️ [scraper] Nessuna preview trovata al primo tentativo, riprovo...");
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

        if (!previewUrl) {
            console.warn("⚠️ [scraper] Nessuna preview trovata dopo due tentativi.");
            return [];
        }

        console.log("✅ [scraper] Preview trovata:", previewUrl);

        // 2) Costruiamo le immagini ad alta risoluzione
        const base = previewUrl.replace("PREVIEW_SMALL.webp", "");
        console.log("[scraper] Base URL immagini:", base);

        const images = [];

        for (let i = 1; i <= 50; i++) { // limite massimo 50 pagine
            const url = `${base}image_page_${i}.webp`;
            console.log(`[scraper] Controllo pagina ${i}: ${url}`);

            try {
                // Node 22 ha fetch globale
                const res = await fetch(url, { method: "HEAD" });
                console.log(`[scraper]  -> HEAD status: ${res.status}`);

                if (!res.ok) {
                    console.log("[scraper]  -> status non OK, mi fermo qui.");
                    break;
                }

                images.push(url);
            } catch (err) {
                console.error(`❌ [scraper] Errore durante la HEAD per pagina ${i}:`, err);
                break;
            }
        }

        console.log(`📄 [scraper] Immagini trovate: ${images.length}`);
        return images;
    } catch (err) {
        console.error("❌ [scraper] Errore top-level in scrapeKnowunity:", err);
        return [];
    } finally {
        try {
            await page.close();
            console.log("[scraper] Page chiusa correttamente");
        } catch (err) {
            console.error("⚠️ [scraper] Errore chiudendo la page:", err);
        }
    }
}

module.exports = {
    scrapeKnowunity
};
