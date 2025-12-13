let active = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "start") {
    active = true;
    console.log("Background: mode ACTIF");
    sendResponse && sendResponse({ ok: true, active });
    return true;
  }

  if (msg.action === "stop") {
    active = false;
    console.log("Background: mode INACTIF");
    sendResponse && sendResponse({ ok: true, active });
    return true;
  }

  // Permet au popup de récupérer l'état actuel
  if (msg.action === "getState") {
    sendResponse && sendResponse({ active });
    return true;
  }

  if (msg.action === "downloadImageBase64") {
    if (!active) {
      console.warn("Background: ignoré (inactif):", msg.filename);
      sendResponse && sendResponse({ ok: false, reason: "inactive", active });
      return true;
    }

    const mime = msg.mime || "image/png";
    const dataUrl = `data:${mime};base64,${msg.data}`;
    let safeName = msg.filename || ("image_" + Date.now() + ".png");

    // Vérifie que le nom a une extension
    if (!/\.[a-z0-9]+$/i.test(safeName)) safeName += ".png";

    console.log("Background: téléchargement via data URL:", safeName, "mime:", mime);

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: "images/" + safeName,
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Background: erreur download:", chrome.runtime.lastError);
        } else {
          console.log("Background: téléchargement lancé, ID:", downloadId);
        }
      }
    );

    sendResponse && sendResponse({ ok: true, active });
    return true;
  }
});
