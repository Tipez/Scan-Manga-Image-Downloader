// --------------------
// Mode popup (UI ON/OFF)
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  const toggleStartBtn = document.getElementById("toggleStart");

  let isActive = false;

  // Récupérer l'état actuel depuis le background au chargement du popup
  chrome.runtime.sendMessage({ action: "getState" }, (resp) => {
    if (resp && typeof resp.active === "boolean") {
      isActive = resp.active;
      toggleStartBtn.textContent = isActive ? "⏹ Stop" : "▶️ Start";
    }
  });

  // Bouton Start/Stop
  toggleStartBtn?.addEventListener("click", () => {
    isActive = !isActive;
    const action = isActive ? "start" : "stop";
    toggleStartBtn.textContent = isActive ? "⏹ Stop" : "▶️ Start";

    console.log("Popup:", action.toUpperCase(), "cliqué");
    chrome.runtime.sendMessage({ action }, (resp) => {
      console.log("Popup: réponse background", action, resp);
    });
  });
});

// --------------------
// Mode content script (injecté dans la page)
// Surveille et capture les images <img>, y compris blob: et data:
// --------------------
(function contentScriptCapture() {
  // Si on est dans le popup, on ne lance pas le mode page
  if (document.getElementById("toggleStart")) return;

  console.log("ContentScript: actif → surveillance des images de la page");

  const processed = new Set();

  function extFromMime(mime) {
    const map = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
      "image/tiff": "tif"
    };
    return map[mime?.toLowerCase()] || "png";
  }

  function extFromUrl(url) {
    try {
      const clean = url.split("?")[0].split("#")[0];
      const last = clean.split("/").pop() || "";
      const m = last.match(/\.(png|jpe?g|webp|gif|svg|bmp|tif?f)$/i);
      return m ? m[0].slice(1).toLowerCase() : null;
    } catch {
      return null;
    }
  }

  function ensureFilenameWithExt(baseName, url, mimeHint) {
    const urlExt = extFromUrl(url);
    const ext = urlExt || extFromMime(mimeHint || "image/png");

    let name = (baseName || "image_" + Date.now()).replace(/[\\/:*?"<>|]/g, "_");

    const hasExt = /\.[A-Za-z0-9]+$/.test(name);
    if (!hasExt) {
      name += "." + ext;
    } else {
      const currentExt = name.split(".").pop().toLowerCase();
      if (!/(png|jpg|jpeg|webp|gif|svg|bmp|tif|tiff)/.test(currentExt)) {
        name += "." + ext;
      }
    }
    return name;
  }

  function filenameFromUrl(url) {
    try {
      const clean = url.split("?")[0].split("#")[0];
      const last = clean.split("/").pop() || ("image_" + Date.now());
      return last.replace(/[\\/:*?"<>|]/g, "_");
    } catch {
      return "image_" + Date.now();
    }
  }

  function sendBlobToBackground(blob, suggestedName, urlForExt, mimeHint) {
    const reader = new FileReader();
    reader.onload = function () {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      const detectedMime = (dataUrl.split(";")[0] || "data:image/png").replace("data:", "");
      const finalMime = mimeHint || detectedMime;

      const finalName = ensureFilenameWithExt(suggestedName, urlForExt, finalMime);

      console.log("ContentScript: blob converti → base64, mime:", finalMime, "filename:", finalName);
      chrome.runtime.sendMessage(
        {
          action: "downloadImageBase64",
          data: base64,
          filename: finalName,
          mime: finalMime
        },
        (resp) => {
          console.log("ContentScript: réponse background download:", resp);
        }
      );
    };
    reader.onerror = (e) => {
      console.warn("ContentScript: erreur FileReader:", e);
    };
    reader.readAsDataURL(blob);
  }

  async function captureViaCanvas(img) {
    try {
      await img.decode?.();
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        console.warn("ContentScript: dimensions invalides pour canvas");
        return false;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];

      const suggestedName = filenameFromUrl(img.src);
      const finalName = ensureFilenameWithExt(suggestedName, img.src, "image/png");

      console.log("ContentScript: capture canvas OK →", finalName, "taille base64:", base64.length);
      chrome.runtime.sendMessage({
        action: "downloadImageBase64",
        data: base64,
        filename: finalName,
        mime: "image/png"
      });
      return true;
    } catch (e) {
      console.warn("ContentScript: canvas capture échouée (CORS/taint?)", e);
      return false;
    }
  }

  async function processImg(img) {
    if (!img || !img.src) return;
    if (processed.has(img.src)) return;
    processed.add(img.src);

    const src = img.src;
    console.log("ContentScript: nouvelle image détectée:", src);

    // data: → direct
    if (src.startsWith("data:")) {
      const [meta, base64] = src.split(",");
      const mime = (meta.split(";")[0] || "data:image/png").replace("data:", "");
      const suggestedName = filenameFromUrl("data_" + Date.now());
      const finalName = ensureFilenameWithExt(suggestedName, src, mime);

      console.log("ContentScript: data URL → envoi direct, mime:", mime, "filename:", finalName);
      chrome.runtime.sendMessage({
        action: "downloadImageBase64",
        data: base64,
        filename: finalName,
        mime
      });
      return;
    }

    // blob: → canvas d’abord, fetch en fallback
    if (src.startsWith("blob:")) {
      const ok = await captureViaCanvas(img);
      if (!ok) {
        try {
          console.log("ContentScript: tentative fetch blob:", src);
          const res = await fetch(src);
          const blob = await res.blob();
          const suggestedName = filenameFromUrl(src);
          sendBlobToBackground(blob, suggestedName, src, blob.type);
        } catch (e) {
          console.warn("ContentScript: fetch blob échoué:", e);
        }
      }
      return;
    }

    // http(s): fetch direct, canvas en fallback
    try {
      console.log("ContentScript: tentative fetch URL:", src);
      const res = await fetch(src, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const suggestedName = filenameFromUrl(src);
      sendBlobToBackground(blob, suggestedName, src, blob.type);
    } catch (e) {
      console.warn("ContentScript: fetch direct échoué, tentative canvas:", e);
      await captureViaCanvas(img);
    }
  }

  // Traiter les images déjà présentes
  document.querySelectorAll("img[src]").forEach(processImg);

  // Observer les images ajoutées dynamiquement
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.tagName === "IMG" && node.src) {
          processImg(node);
        } else if (node.nodeType === 1) {
          node.querySelectorAll?.("img[src]").forEach(processImg);
        }
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Écouter les changements de src sur <img> existantes
  const imgs = new Set(document.querySelectorAll("img"));
  imgs.forEach((img) => {
    const attrObserver = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.type === "attributes" && m.attributeName === "src" && img.src) {
          processImg(img);
        }
      });
    });
    attrObserver.observe(img, { attributes: true });
  });
})();
