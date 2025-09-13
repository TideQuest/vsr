// Try to obtain ReclaimClient in as many environments as possible
let ReclaimClientRef = null;
try {
  if (typeof require === 'function') {
    // If a bundler/polyfill provides require
    const lib = require("@reclaimprotocol/zk-fetch");
    ReclaimClientRef = lib?.ReclaimClient || null;
  }
} catch (_) {}
if (!ReclaimClientRef && typeof window !== 'undefined' && window?.module?.exports?.ReclaimClient) {
  ReclaimClientRef = window.module.exports.ReclaimClient;
}

document.addEventListener("DOMContentLoaded", function () {
  const statusEl = document.getElementById("status");
  const dataContainer = document.getElementById("dataContainer");
  const fetchBtn = document.getElementById("fetchBtn");
  const clearBtn = document.getElementById("clearBtn");
  const tabs = document.querySelectorAll(".tab");
  const genProofBtn = document.getElementById("genProofBtn");
  const appIdInput = document.getElementById("appIdInput");
  const reclaimAppId = document.getElementById("reclaimAppId");
  const reclaimAppSecret = document.getElementById("reclaimAppSecret");
  const proofStatus = document.getElementById("proofStatus");
  const proofOutput = document.getElementById("proofOutput");

  let currentTab = "overview";
  let userData = null;

  function updateStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.backgroundColor = isError ? "#ffebee" : "#f0f8ff";
    statusEl.style.borderColor = isError ? "#e74c3c" : "#4a90e2";
    statusEl.style.color = isError ? "#e74c3c" : "#333";
  }

  function showLoading() {
    updateStatus("Fetching Steam data...");
    fetchBtn.disabled = true;
    fetchBtn.textContent = "Fetching...";
    dataContainer.innerHTML =
      '<div class="loading">Loading Steam user data...</div>';
  }

  function hideLoading() {
    fetchBtn.disabled = false;
    fetchBtn.textContent = "Fetch Steam User Data";
  }

  function setProofStatus(message, isError = false) {
    proofStatus.style.display = 'block';
    proofStatus.textContent = message;
    proofStatus.style.backgroundColor = isError ? "#ffebee" : "#f0f8ff";
    proofStatus.style.borderColor = isError ? "#e74c3c" : "#4a90e2";
    proofStatus.style.color = isError ? "#e74c3c" : "#333";
  }

  function showProofOutput(obj) {
    proofOutput.style.display = 'block';
    proofOutput.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  }

  function displayOverview() {
    if (!userData) {
      dataContainer.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    const fetchTime = new Date(userData.fetchTime).toLocaleString();

    dataContainer.innerHTML = `
      <div class="data-item">
        <strong>Steam ID:</strong> ${userData.steamId}
      </div>
      <div class="data-item">
        <strong>Country:</strong> ${userData.countryCode}
      </div>
      <div class="data-item">
        <strong>Account Balance:</strong> ${userData.accountBalance}
      </div>
      <div class="summary">
        <span>Games: ${userData.ownedGames.length}</span>
        <span>Wishlist: ${userData.wishlist.length}</span>
        <span>Tags: ${
          userData.recommendedTags ? userData.recommendedTags.length : 0
        }</span>
      </div>
      ${
        userData.hardwareUsed && userData.hardwareUsed.length > 0
          ? `
        <div class="data-item">
          <strong>Hardware Used:</strong> ${userData.hardwareUsed.join(", ")}
        </div>
      `
          : ""
      }
      ${
        userData.recommendedTags && userData.recommendedTags.length > 0
          ? `
        <div class="data-item">
          <strong>Top Tags:</strong> ${userData.recommendedTags
            .slice(0, 5)
            .map((tag) => tag.name)
            .join(", ")}
        </div>
      `
          : ""
      }
      <div class="data-item">
        <strong>Data Source:</strong> ${userData.sourceUrl}
      </div>
      <div class="timestamp">
        Last fetched: ${fetchTime}
      </div>
    `;
  }

  function displayGames() {
    if (!userData || !userData.ownedGames.length) {
      dataContainer.innerHTML =
        '<div class="no-data">No owned games found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Owned Games (${userData.ownedGames.length})</strong></div>`;

    userData.ownedGames.slice(0, 50).forEach((game) => {
      const playtime = game.playtime
        ? `${Math.round(game.playtime / 60)} hours`
        : "Unknown playtime";
      const gameName =
        game.name && game.name !== `App ${game.appId}`
          ? game.name
          : `App ${game.appId}`;
      const developers =
        game.developers && game.developers.length > 0
          ? ` (${game.developers.join(", ")})`
          : "";
      const type = game.type ? ` [${game.type}]` : "";
      const genres =
        game.genres && game.genres.length > 0
          ? ` | ${game.genres.map((g) => g.description).join(", ")}`
          : "";

      html += `
        <div class="game-item">
          <div><strong>${gameName}${developers}</strong>${type}</div>
          <div>App ID: ${game.appId} | Playtime: ${playtime}${genres}</div>
          ${
            game.source
              ? `<div style="font-size: 10px; color: #888;">Source: ${game.source}</div>`
              : ""
          }
        </div>
      `;
    });

    if (userData.ownedGames.length > 50) {
      html += `<div class="no-data">... and ${
        userData.ownedGames.length - 50
      } more games</div>`;
    }

    dataContainer.innerHTML = html;
  }

  function displayWishlist() {
    if (!userData || !userData.wishlist.length) {
      dataContainer.innerHTML =
        '<div class="no-data">No wishlist items found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Wishlist (${userData.wishlist.length})</strong></div>`;

    userData.wishlist.slice(0, 30).forEach((item) => {
      const itemName =
        item.name && item.name !== `App ${item.appId}`
          ? item.name
          : `App ${item.appId}`;
      const type = item.type ? ` [${item.type}]` : "";

      html += `
        <div class="game-item">
          <div><strong>${itemName}</strong>${type}</div>
          <div>App ID: ${item.appId} | Priority: ${item.priority}</div>
          ${
            item.source
              ? `<div style="font-size: 10px; color: #888;">Source: ${item.source}</div>`
              : ""
          }
        </div>
      `;
    });

    if (userData.wishlist.length > 30) {
      html += `<div class="no-data">... and ${
        userData.wishlist.length - 30
      } more items</div>`;
    }

    dataContainer.innerHTML = html;
  }

  function displayTags() {
    if (
      !userData ||
      !userData.recommendedTags ||
      userData.recommendedTags.length === 0
    ) {
      dataContainer.innerHTML =
        '<div class="no-data">No recommended tags found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Recommended Tags (${userData.recommendedTags.length})</strong></div>`;

    userData.recommendedTags.forEach((tag) => {
      html += `
        <div class="game-item">
          <div><strong>${tag.name}</strong></div>
          <div>Tag ID: ${tag.tagId}</div>
        </div>
      `;
    });

    dataContainer.innerHTML = html;
  }

  function displayCurrentTab() {
    switch (currentTab) {
      case "overview":
        displayOverview();
        break;
      case "games":
        displayGames();
        break;
      case "wishlist":
        displayWishlist();
        break;
      case "tags":
        displayTags();
        break;
    }
  }

  function loadExistingData() {
    chrome.runtime.sendMessage({ action: "getSteamUserData" }, (response) => {
      if (response) {
        userData = response;
        updateStatus("Data loaded from cache");
        displayCurrentTab();
      }
    });

    // Load saved inputs
    chrome.storage.local.get(["zk_app_id","zk_app_secret","zk_appid_target"], (res) => {
      if (res.zk_app_id) reclaimAppId.value = res.zk_app_id;
      if (res.zk_app_secret) reclaimAppSecret.value = res.zk_app_secret;
      if (res.zk_appid_target) appIdInput.value = res.zk_appid_target;
    });
  }

  function fetchSteamData() {
    showLoading();

    chrome.runtime.sendMessage({ action: "fetchSteamUserData" }, (response) => {
      hideLoading();

      if (response.success) {
        userData = response.data;
        updateStatus("Steam data fetched successfully!");
        displayCurrentTab();
      } else {
        updateStatus(`Error: ${response.error}`, true);
        dataContainer.innerHTML = `<div class="error">${response.error}</div>`;
      }
    });
  }

  function clearData() {
    chrome.runtime.sendMessage({ action: "clearData" }, (response) => {
      if (response.success) {
        userData = null;
        updateStatus("Data cleared");
        dataContainer.innerHTML =
          '<div class="no-data">Click "Fetch Steam User Data" to get started</div>';
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      displayCurrentTab();
    });
  });

  fetchBtn.addEventListener("click", fetchSteamData);
  clearBtn.addEventListener("click", clearData);

  genProofBtn.addEventListener("click", async () => {
    proofOutput.style.display = 'none';
    setProofStatus("Preparing proof request...");

    const targetAppId = (appIdInput.value || '').trim();
    const appId = (reclaimAppId.value || '').trim();
    const appSecret = (reclaimAppSecret.value || '').trim();

    // Persist inputs
    chrome.storage.local.set({
      zk_app_id: appId,
      zk_app_secret: appSecret,
      zk_appid_target: targetAppId,
    });

    if (!targetAppId) {
      setProofStatus("Please enter an App ID to prove", true);
      return;
    }
    if (!appId || !appSecret) {
      setProofStatus("Please enter Reclaim Application ID and Secret", true);
      return;
    }

    // Ask background for the current user's URL and cookies
    chrome.runtime.sendMessage({ action: 'getUserDataUrlAndCookies' }, async (resp) => {
      if (!resp || !resp.success) {
        setProofStatus(`Failed to prepare: ${resp?.error || 'unknown error'}`, true);
        return;
      }

      const { url, steamId, cookieStr } = resp.data;

      // Build regex to match presence of the appId in rgOwnedApps
      const regex = `"rgOwnedApps":\\s*\\[[^\\]]*\\b${targetAppId}\\b`;

      if (!ReclaimClientRef) {
        setProofStatus("ReclaimClient not available in this build. Bundle @reclaimprotocol/zk-fetch or load a browser build.", true);
        showProofOutput({
          hint: "Use a bundler (e.g., Browserify/Webpack) so require('@reclaimprotocol/zk-fetch') works in the popup, or inject a pre-bundled UMD build that sets window.module.exports.ReclaimClient.",
          request: { url, steamId, regex }
        });
        return;
      }

      try {
        setProofStatus("Generating proof via zkFetch... this can take ~10-30s");
        const client = new ReclaimClientRef(appId, appSecret);

        const proof = await client.zkFetch(
          url,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          },
          {
            cookieStr,
            responseMatches: [ { type: 'regex', value: regex } ],
          },
          2,
          1500
        );

        if (!proof) {
          setProofStatus("No proof returned", true);
          return;
        }

        setProofStatus("Proof generated successfully!");
        showProofOutput(proof);
      } catch (err) {
        setProofStatus(`Error generating proof: ${err?.message || String(err)}`, true);
        showProofOutput({ error: err?.message || String(err) });
      }
    });
  });

  loadExistingData();
});
