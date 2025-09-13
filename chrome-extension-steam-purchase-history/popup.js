document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const dataContainer = document.getElementById('dataContainer');
  const fetchBtn = document.getElementById('fetchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const tabs = document.querySelectorAll('.tab');

  let currentTab = 'overview';
  let userData = null;

  function updateStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.backgroundColor = isError ? '#ffebee' : '#f0f8ff';
    statusEl.style.borderColor = isError ? '#e74c3c' : '#4a90e2';
    statusEl.style.color = isError ? '#e74c3c' : '#333';
  }

  function showLoading() {
    updateStatus('Fetching Steam data...');
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    dataContainer.innerHTML = '<div class="loading">Loading Steam user data...</div>';
  }

  function hideLoading() {
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'Fetch Steam User Data';
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
        <span>Tags: ${userData.recommendedTags ? userData.recommendedTags.length : 0}</span>
      </div>
      ${userData.hardwareUsed && userData.hardwareUsed.length > 0 ? `
        <div class="data-item">
          <strong>Hardware Used:</strong> ${userData.hardwareUsed.join(', ')}
        </div>
      ` : ''}
      ${userData.recommendedTags && userData.recommendedTags.length > 0 ? `
        <div class="data-item">
          <strong>Top Tags:</strong> ${userData.recommendedTags.slice(0, 5).map(tag => tag.name).join(', ')}
        </div>
      ` : ''}
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
      dataContainer.innerHTML = '<div class="no-data">No owned games found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Owned Games (${userData.ownedGames.length})</strong></div>`;

    userData.ownedGames.slice(0, 50).forEach(game => {
      const playtime = game.playtime ? `${Math.round(game.playtime / 60)} hours` : 'Unknown playtime';
      const gameName = game.name && game.name !== `App ${game.appId}` ? game.name : `App ${game.appId}`;
      const developers = game.developers && game.developers.length > 0 ? ` (${game.developers.join(', ')})` : '';
      const type = game.type ? ` [${game.type}]` : '';
      const genres = game.genres && game.genres.length > 0 ? ` | ${game.genres.map(g => g.description).join(', ')}` : '';

      html += `
        <div class="game-item">
          <div><strong>${gameName}${developers}</strong>${type}</div>
          <div>App ID: ${game.appId} | Playtime: ${playtime}${genres}</div>
          ${game.source ? `<div style="font-size: 10px; color: #888;">Source: ${game.source}</div>` : ''}
        </div>
      `;
    });

    if (userData.ownedGames.length > 50) {
      html += `<div class="no-data">... and ${userData.ownedGames.length - 50} more games</div>`;
    }

    dataContainer.innerHTML = html;
  }

  function displayWishlist() {
    if (!userData || !userData.wishlist.length) {
      dataContainer.innerHTML = '<div class="no-data">No wishlist items found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Wishlist (${userData.wishlist.length})</strong></div>`;

    userData.wishlist.slice(0, 30).forEach(item => {
      const itemName = item.name && item.name !== `App ${item.appId}` ? item.name : `App ${item.appId}`;
      const type = item.type ? ` [${item.type}]` : '';

      html += `
        <div class="game-item">
          <div><strong>${itemName}</strong>${type}</div>
          <div>App ID: ${item.appId} | Priority: ${item.priority}</div>
          ${item.source ? `<div style="font-size: 10px; color: #888;">Source: ${item.source}</div>` : ''}
        </div>
      `;
    });

    if (userData.wishlist.length > 30) {
      html += `<div class="no-data">... and ${userData.wishlist.length - 30} more items</div>`;
    }

    dataContainer.innerHTML = html;
  }

  function displayTags() {
    if (!userData || !userData.recommendedTags || userData.recommendedTags.length === 0) {
      dataContainer.innerHTML = '<div class="no-data">No recommended tags found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Recommended Tags (${userData.recommendedTags.length})</strong></div>`;

    userData.recommendedTags.forEach(tag => {
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
      case 'overview':
        displayOverview();
        break;
      case 'games':
        displayGames();
        break;
      case 'wishlist':
        displayWishlist();
        break;
      case 'tags':
        displayTags();
        break;
    }
  }

  function loadExistingData() {
    chrome.runtime.sendMessage({ action: 'getSteamUserData' }, (response) => {
      if (response) {
        userData = response;
        updateStatus('Data loaded from cache');
        displayCurrentTab();
      }
    });
  }

  function fetchSteamData() {
    showLoading();

    chrome.runtime.sendMessage({ action: 'fetchSteamUserData' }, (response) => {
      hideLoading();

      if (response.success) {
        userData = response.data;
        updateStatus('Steam data fetched successfully!');
        displayCurrentTab();
      } else {
        updateStatus(`Error: ${response.error}`, true);
        dataContainer.innerHTML = `<div class="error">${response.error}</div>`;
      }
    });
  }


  function clearData() {
    chrome.runtime.sendMessage({ action: 'clearData' }, (response) => {
      if (response.success) {
        userData = null;
        updateStatus('Data cleared');
        dataContainer.innerHTML = '<div class="no-data">Click "Fetch Steam User Data" to get started</div>';
      }
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      displayCurrentTab();
    });
  });

  fetchBtn.addEventListener('click', fetchSteamData);
  clearBtn.addEventListener('click', clearData);

  loadExistingData();
});