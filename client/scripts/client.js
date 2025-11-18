const queries = new URLSearchParams(location.search);
const res = document.getElementById("result");
const form = document.querySelector("form");

function displayLoading() {
    res.style.visibility = "visible";
    res.classList.remove("err", "succ");
    res.classList.add("loading");
    res.textContent = "⏳ Sto scaricando gli appunti...";
}

function isValidQuery() {
    return queries.size === 1 && (queries.has("error") || queries.has("success"));
}

function handleError(err = -1) {
    switch (err) {
        case 1: res.textContent = "❌ URL non valido"; break;
        case 2: res.textContent = "❌ timeout, riprova"; break;
        case 3: res.textContent = "❌ nessuna immagine trovata"; break;
        case 4: res.textContent = "❌ server error"; break;
        default: return;
    }
    res.classList.remove("loading");
    res.classList.add("err");
    res.style.visibility = "visible";
}
function handleSuccess(succ = -1) {
    res.classList.remove("loading");
    if (succ === 1){
        window.location = "/download.pdf";
    //else if (succ === 2) {
        res.classList.add("succ");
        res.style.visibility = "visible";
        res.textContent = "✅ PDF generato e scaricato!";
    }
}

function displayResult() {
    if (!isValidQuery()) return;

    if (queries.has("error"))
        handleError(Number(queries.get("error")));
    else if (queries.has("success"))
        handleSuccess(Number(queries.get("success")));
}

form.addEventListener("submit", displayLoading);
window.addEventListener("load", displayResult);