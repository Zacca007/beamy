# ✨ Beamy

Un server web locale che permette di scaricare appunti da Knowunity in formato PDF.

## 📋 Cos'è

Knowunity Downloader è un tool che ti permette di convertire gli appunti di Knowunity in file PDF scaricabili. Funziona completamente in locale sul tuo computer e utilizza la tua sessione di login per accedere ai contenuti.

## 🚀 Come funziona

1. Inserisci l'URL di un appunto Knowunity
2. Il server scarica automaticamente tutte le immagini
3. Le converte in un PDF ottimizzato
4. Scarichi il file sul tuo computer

## 📦 Installazione

### Requisiti
- **Node.js** (versione 18 o superiore)
- Un account Knowunity attivo

### Setup

1. **Clona o scarica il progetto**
   ```bash
   git clone https://github.com/Zacca007/beamy.git
   cd beamy
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Installa i browser di Playwright**
   ```bash
   npx playwright install chromium
   ```

4. **IMPORTANTE: Salva i token di sessione di Knowunity**
   
   Prima di poter usare il downloader, devi salvare i tuoi dati di login. Esegui:
   ```bash
   node src/knowunitySession.js
   ```
   
   - Si aprirà automaticamente una finestra del browser
   - **Fai login sul sito di Knowunity** con le tue credenziali
   - Aspetta di essere completamente loggato (dovresti vedere la homepage o i tuoi appunti)
   - Torna al terminale e **premi INVIO**
   - I tuoi token di sessione verranno salvati nel file `server/knowunity-session.json`
   
   ⚠️ **Questo passaggio va fatto solo la prima volta** (o quando la sessione scade)

5. **Avvia il server**
   ```bash
   node server/server.js
   ```
   
   Dovresti vedere il messaggio: `✅ server attivo`

6. **Apri il browser**
   
   Vai su: `http://127.0.0.1:8000`

## 🎯 Utilizzo

1. **Assicurati che il server sia avviato** (vedi punto 5 dell'installazione)
2. Apri un appunto su Knowunity nel tuo browser normale e copia il link (deve essere nel formato `https://knowunity.it/knows/...`)
3. Vai su `http://127.0.0.1:8000`
4. Incolla il link nell'interfaccia web
5. Clicca su "Scarica 💾"
6. Attendi che il PDF venga generato e scaricato automaticamente

### Come funziona dietro le quinte
Il server utilizza i token di sessione che hai salvato per accedere a Knowunity automaticamente, scaricare tutte le immagini dell'appunto e convertirle in un PDF.

## 🛑 Fermare il server

Premi `CTRL+C` nel terminale per arrestare il server in modo pulito.

## ⚠️ Note importanti

- Il server funziona solo in locale (non è accessibile da altri computer)
- **I token di sessione scadono dopo un po' di tempo**: se inizi a ricevere errori, ripeti il punto 4 del setup per rinnovare la sessione
- I PDF vengono generati al momento e non vengono salvati sul server
- È necessario essere connessi a internet per scaricare gli appunti
- Il file `server/knowunity-session.json` contiene i tuoi dati di sessione: **non condividerlo con nessuno**

## 🔧 Risoluzione problemi

**Il server non si avvia**
- Verifica di avere Node.js installato: `node --version`
- Controlla che la porta 8000 non sia già in uso

**Errore durante il download**
- Verifica che l'URL sia corretto e inizi con `https://knowunity.it/knows/`
- Controlla di aver configurato correttamente la sessione
- Prova a rinnovare la sessione ripetendo il punto 4 del setup

**Il PDF è vuoto o incompleto**
- Alcuni appunti potrebbero non essere disponibili o protetti
- Riprova più tardi o con un altro appunto

## 📄 Licenza

ISC

---

Made with ❤️ by the greatest computer scientist of all time
