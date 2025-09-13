// Background script for Amazon Purchase History Extractor

chrome.runtime.onInstalled.addListener(() => {
  console.log('Amazon Purchase History Extractor installed');

  // コンテキストメニューの追加
  try {
    chrome.contextMenus.create({
      id: 'extract-amazon-history',
      title: 'Amazon購入履歴を抽出',
      contexts: ['page'],
      documentUrlPatterns: ['https://*.amazon.com/*', 'https://*.amazon.co.jp/*']
    });
  } catch (error) {
    console.log('Context menu creation failed:', error);
  }
});

// メッセージハンドリング
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extraction_complete') {
    // 抽出完了通知をポップアップに転送
    chrome.runtime.sendMessage({
      action: 'extraction_complete',
      ordersCount: request.ordersCount,
      totalOrders: request.totalOrders
    }).catch(() => {
      // ポップアップが開いていない場合はエラーを無視
    });
  }

  if (request.action === 'get_storage_data') {
    chrome.storage.local.get(['amazonOrders', 'lastExtracted'], (result) => {
      sendResponse(result);
    });
    return true; // 非同期レスポンスを示す
  }

  if (request.action === 'clear_storage') {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// タブ更新時の処理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Amazon注文履歴ページかチェック
    if (tab.url.includes('amazon') && tab.url.includes('order-history')) {
      console.log('Amazon order history page detected');

      // content scriptが既に注入されているかチェック
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
          return window.amazonExtractorInjected;
        }
      }).then((results) => {
        if (!results[0]?.result) {
          // content scriptを手動で注入
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
        }
      }).catch((error) => {
        console.log('Could not inject content script:', error);
      });
    }
  }
});

// ストレージ変更の監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.amazonOrders) {
    console.log('Amazon orders data updated:', changes.amazonOrders.newValue?.length || 0, 'orders');
  }
});

// コンテキストメニューのクリックイベント
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'extract-amazon-history') {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // content scriptの抽出関数を呼び出し
          if (typeof extractPurchaseHistory === 'function') {
            const orders = extractPurchaseHistory();
            if (orders.length > 0) {
              saveToStorage(orders);
            }
          }
        }
      }).catch((error) => {
        console.log('Script execution failed:', error);
      });
    }
  });
}