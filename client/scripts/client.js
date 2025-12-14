const queries = new URLSearchParams(location.search);
const res = document.getElementById("result");
const form = document.querySelector("form");

function isValidQuery() {
    return queries.size === 1 && (queries.has("error") || queries.has("success"));
}

function setStatus(kind, text) {
    res.hidden = false;
    res.classList.remove("err", "succ", "loading");
    if (kind) res.classList.add(kind);
    res.textContent = text;
}

function triggerDownload(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "appunti.pdf";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function handleError(code) {
    const msg = ({
        1: "❌ URL non valido",
        2: "❌ timeout, riprova",
        3: "❌ nessuna immagine trovata",
        4: "❌ server error",
    })[code];
    if (msg) setStatus("err", msg);
}

function handleSuccess(code) {
    if (code !== 1) return;

    setStatus("succ", "✅ PDF generato!");
    if (history.state?.pdfTriggered) return;

    triggerDownload("/download.pdf");
    history.replaceState({ pdfTriggered: true }, "", location.href);
}

function displayResult() {
    if (!isValidQuery()) return;

    if (queries.has("error"))
        handleError(Number(queries.get("error")));
    else if (queries.has("success"))
        handleSuccess(Number(queries.get("success")));
}

form.addEventListener("submit", () => {
    setStatus("loading", "⏳ Sto scaricando gli appunti...");
    history.replaceState({ pdfTriggered: false }, "", location.href);
});

window.addEventListener("pageshow", displayResult);
window.addEventListener("load", displayResult);