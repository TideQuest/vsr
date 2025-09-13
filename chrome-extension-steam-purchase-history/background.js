let steamUserData = null;
let lastFetchTime = 0;


async function fetchSteamUserData() {
  const now = Date.now();

  if (lastFetchTime && (now - lastFetchTime) < 60000) {
    console.log('Data fetched recently, using cached data');
    return steamUserData;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('steampowered.com') && !currentTab.url.includes('steamcommunity.com')) {
      throw new Error('Please visit Steam website first');
    }

    const userDataUrl = await findUserDataUrl(currentTab.id);

    if (!userDataUrl) {
      throw new Error('Could not determine Steam user ID. Please make sure you are logged in.');
    }

    console.log('Fetching Steam userdata from:', userDataUrl);

    const response = await fetch(userDataUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    const userData = parseSteamUserData(responseText);

    steamUserData = {
      ...userData,
      fetchTime: new Date().toISOString(),
      sourceUrl: userDataUrl
    };

    lastFetchTime = now;

    chrome.storage.local.set({
      steamUserData: steamUserData
    });

    return steamUserData;

  } catch (error) {
    console.error('Error fetching Steam userdata:', error);
    throw error;
  }
}

async function findUserDataUrl(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        console.log('Searching for Steam ID...');

        const patterns = [
          /g_steamID\s*=\s*"(\d+)"/,
          /g_steamID\s*=\s*'(\d+)'/,
          /"steamid":\s*"(\d+)"/,
          /"steamid":\s*(\d+)/,
          /dynamicstore\/userdata\/\?id=(\d+)/,
          /steamcommunity\.com\/profiles\/(\d+)/,
          /COMMUNITY_BASE_URL\s*=\s*"[^"]*\/profiles\/(\d+)/,
          /"current_steamid":\s*"(\d+)"/,
          /window\.g_steamID\s*=\s*"(\d+)"/,
          /var g_steamID\s*=\s*"(\d+)"/
        ];

        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || script.innerHTML;
          if (!content) continue;

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              const steamId = match[1];
              console.log(`Found Steam ID: ${steamId} using pattern: ${pattern}`);
              return {
                steamId: steamId,
                url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
                method: 'script_pattern'
              };
            }
          }
        }

        const profileLinks = document.querySelectorAll('a[href*="/profiles/"]');
        for (const link of profileLinks) {
          const href = link.href;
          const match = href.match(/\/profiles\/(\d+)/);
          if (match && match[1]) {
            const steamId = match[1];
            console.log(`Found Steam ID from profile link: ${steamId}`);
            return {
              steamId: steamId,
              url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
              method: 'profile_link'
            };
          }
        }

        const metaTags = document.querySelectorAll('meta[property*="steamid"], meta[name*="steamid"]');
        for (const meta of metaTags) {
          const content = meta.getAttribute('content');
          if (content && /^\d+$/.test(content)) {
            console.log(`Found Steam ID from meta tag: ${content}`);
            return {
              steamId: content,
              url: `https://store.steampowered.com/dynamicstore/userdata/?id=${content}&cc=JP`,
              method: 'meta_tag'
            };
          }
        }

        const currentUrl = window.location.href;
        const urlMatch = currentUrl.match(/\/profiles\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
          const steamId = urlMatch[1];
          console.log(`Found Steam ID from current URL: ${steamId}`);
          return {
            steamId: steamId,
            url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
            method: 'current_url'
          };
        }

        console.log('No Steam ID found');
        return null;
      }
    });

    const result = results[0]?.result;
    if (result) {
      console.log(`Steam ID detection successful: ${result.steamId} (method: ${result.method})`);
      return result.url;
    }

    return null;
  } catch (error) {
    console.error('Error finding Steam user ID:', error);
    return null;
  }
}

function parseSteamUserData(responseText) {
  try {
    const jsonData = JSON.parse(responseText);

    const userData = {
      steamId: jsonData.steamid || 'unknown',
      countryCode: jsonData.country_code || 'JP',
      ownedGames: [],
      wishlist: [],
      recentlyPlayed: [],
      accountBalance: jsonData.wallet ? jsonData.wallet.formatted_balance : 'unknown',
      recommendedTags: [],
      hardwareUsed: jsonData.rgHardwareUsed || [],
      primaryLanguage: jsonData.rgPrimaryLanguage || 'unknown'
    };

    if (jsonData.rgOwnedApps && Array.isArray(jsonData.rgOwnedApps)) {
      userData.ownedGames = jsonData.rgOwnedApps.map(appId => ({
        appId: appId.toString(),
        name: `App ${appId}`,
        playtime: 0,
        source: 'rgOwnedApps'
      }));
    }

    if (jsonData.rgWishlist && Array.isArray(jsonData.rgWishlist)) {
      userData.wishlist = jsonData.rgWishlist.map(appId => ({
        appId: appId.toString(),
        name: `App ${appId}`,
        priority: 0,
        source: 'rgWishlist'
      }));
    }

    if (jsonData.rgRecommendedTags && Array.isArray(jsonData.rgRecommendedTags)) {
      userData.recommendedTags = jsonData.rgRecommendedTags.map(tag => ({
        tagId: tag.tagid,
        name: tag.name
      }));
    }

    if (jsonData.rgRecentlyPlayed && Array.isArray(jsonData.rgRecentlyPlayed)) {
      userData.recentlyPlayed = jsonData.rgRecentlyPlayed.map(game => ({
        appId: game.appid,
        name: game.name,
        playtime2weeks: game.playtime_2weeks || 0,
        playtimeForever: game.playtime_forever || 0
      }));
    }

    if (jsonData.rgOwnedPackages && Array.isArray(jsonData.rgOwnedPackages)) {
      userData.ownedPackages = jsonData.rgOwnedPackages.filter(pkg => pkg !== 0);
    }

    if (jsonData.rgRecommendedApps && Array.isArray(jsonData.rgRecommendedApps)) {
      userData.recommendedApps = jsonData.rgRecommendedApps.slice(0, 20);
    }

    console.log('Parsed Steam userdata:', {
      ownedGames: userData.ownedGames.length,
      wishlist: userData.wishlist.length,
      recommendedTags: userData.recommendedTags.length,
      hardwareUsed: userData.hardwareUsed,
      primaryLanguage: userData.primaryLanguage
    });

    return userData;

  } catch (error) {
    console.error('Error parsing Steam userdata JSON:', error);
    return {
      error: 'Failed to parse Steam userdata',
      rawResponse: responseText.substring(0, 1000),
      parseError: error.message
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchSteamUserData') {
    fetchSteamUserData()
      .then(userData => {
        sendResponse({ success: true, data: userData });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'fetchSteamUserDataManual') {
    if (!request.steamId) {
      sendResponse({ success: false, error: 'Steam ID is required' });
      return;
    }

    fetchSteamUserDataManual(request.steamId)
      .then(userData => {
        sendResponse({ success: true, data: userData });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getSteamUserData') {
    chrome.storage.local.get(['steamUserData'], (result) => {
      sendResponse(result.steamUserData || null);
    });
    return true;
  }

  if (request.action === 'clearData') {
    steamUserData = null;
    lastFetchTime = 0;
    chrome.storage.local.clear();
    sendResponse({ success: true });
  }
});

async function fetchSteamUserDataManual(steamId) {
  const now = Date.now();

  if (lastFetchTime && (now - lastFetchTime) < 60000) {
    console.log('Data fetched recently, using cached data');
    return steamUserData;
  }

  try {
    const userDataUrl = `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`;

    console.log('Fetching Steam userdata from (manual):', userDataUrl);

    const response = await fetch(userDataUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    const userData = parseSteamUserData(responseText);

    steamUserData = {
      ...userData,
      fetchTime: new Date().toISOString(),
      sourceUrl: userDataUrl,
      fetchMethod: 'manual'
    };

    lastFetchTime = now;

    chrome.storage.local.set({
      steamUserData: steamUserData
    });

    return steamUserData;

  } catch (error) {
    console.error('Error fetching Steam userdata (manual):', error);
    throw error;
  }
}