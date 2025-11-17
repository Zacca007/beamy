const queries = new URLSearchParams(location.search);
const res = document.getElementById("result");
const form = document.querySelector("form");

form.addEventListener("submit", () => {
    res.style.visibility = "visible";
    res.classList.remove("err", "succ");
    res.classList.add("loading");
    res.textContent = "⏳ Sto scaricando gli appunti...";
});

if (queries.has("error")) {
    switch (Number(queries.get("error"))) {
        case 1: res.textContent = "❌ invalid URL"; break;
        case 2: res.textContent = "❌timeout, retry"; break;
        case 3: res.textContent = "❌server error"; break;
        default: return;
    }
    res.classList.remove("loading");
    res.classList.add("err");
    res.style.visibility = "visible";
}
else if (queries.has("success")) {
    res.classList.remove("loading");
    res.classList.add("succ");
    res.style.visibility = "visible";
    res.textContent = "⏳ Sto generando il PDF...";

    const a = document.createElement("a");
    a.href = "/download.pdf";
    a.download = "note.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    res.textContent = "✅ PDF generato e scaricato!";
}

