const { chromium } = require('playwright');

(async () => {
    // 1. Apriamo il browser NON headless (così puoi fare login)
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("🌐 Apro la pagina di login...");
    await page.goto("https://www.knowunity.com/en/auth/login");

    console.log("\n👉 Fai login normalmente nel browser.");
    console.log("👉 Quando hai finito e sei nella pagina delle note, torna qui e premi INVIO.\n");

    // 2. Aspettiamo che tu prema INVIO
    process.stdin.resume();
    process.stdin.on("data", async () => {
        try {
            await context.storageState({ path: "knowunity-session.json" });
            console.log("✅ Sessione salvata in knowunity-session.json");
        } catch (err) {
            console.error("❌ Errore nel salvataggio della sessione:", err);
        } finally {
            await browser.close();
            process.exit(0);
        }
    });
})();
