// Background script for Amazon Purchase History Extractor

// ネットワークリクエストの監視対象パターン (Manifest v3対応)
const AMAZON_API_PATTERNS = [
  'https://*.amazon.com/gp/your-account/order-history*',
  'https://*.amazon.co.jp/gp/your-account/order-history*',
  'https://*.amazon.de/gp/your-account/order-history*',
  'https://*.amazon.fr/gp/your-account/order-history*',
  'https://*.amazon.it/gp/your-account/order-history*',
  'https://*.amazon.es/gp/your-account/order-history*',
  'https://*.amazon.co.uk/gp/your-account/order-history*',
  'https://*.amazon.com/gp/css/*',
  'https://*.amazon.co.jp/gp/css/*',
  'https://*.amazon.com/api/*',
  'https://*.amazon.co.jp/api/*',
  'https://*.amazon.com/gp/your-account/*',
  'https://*.amazon.co.jp/gp/your-account/*'
];

// 抽出したネットワークデータを保存
let interceptedData = [];

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

  // Manifest v3では主にcontent scriptでネットワーク監視を実行
  console.log('Background script initialized. Network monitoring will be handled by content scripts.');
});

// 基本的なネットワーク監視 (optional、主にデバッグ用)
function setupBasicNetworkMonitoring() {
  // 簡単なリクエスト監視のみ（レスポンス内容はcontent scriptで取得）
  if (chrome.webRequest && chrome.webRequest.onCompleted) {
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        if (isAmazonOrderRequest(details.url)) {
          console.log('Amazon order request completed:', details.url);

          // content scriptがアクティブな場合のみメッセージ送信
          if (details.tabId > 0) {
            chrome.tabs.sendMessage(details.tabId, {
              action: 'amazon_request_completed',
              url: details.url
            }).catch(() => {
              // content scriptが利用できない場合は無視
            });
          }
        }
      },
      { urls: AMAZON_API_PATTERNS }
    );
  }
}

// Amazon注文履歴関連のリクエストかチェック
function isAmazonOrderRequest(url) {
  const orderKeywords = [
    'order-history',
    'your-orders',
    'orders',
    'purchase',
    'shipment',
    'delivery',
    'order-details'
  ];

  const lowerUrl = url.toLowerCase();
  return orderKeywords.some(keyword => lowerUrl.includes(keyword)) &&
         (lowerUrl.includes('amazon.com') || lowerUrl.includes('amazon.co.jp') ||
          lowerUrl.includes('amazon.de') || lowerUrl.includes('amazon.fr') ||
          lowerUrl.includes('amazon.it') || lowerUrl.includes('amazon.es') ||
          lowerUrl.includes('amazon.co.uk'));
}

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

  // ネットワークデータの受信と処理
  if (request.action === 'network_data_captured') {
    console.log('Network data received:', request.data);

    // 生データの保存
    storeRawNetworkData(request.data);

    // 注文データの処理
    processNetworkData(request.data, sender.tab);
    sendResponse({ success: true });
    return true;
  }

  // ネットワーク監視の開始/停止
  if (request.action === 'start_network_monitoring') {
    console.log('Starting network monitoring for tab:', sender.tab.id);
    sendResponse({ success: true });
    return true;
  }
});

// 生ネットワークデータの保存
function storeRawNetworkData(data) {
  try {
    chrome.storage.local.get(['networkResponses'], (result) => {
      const existingResponses = result.networkResponses || [];

      // 新しいレスポンスデータを追加
      const newResponse = {
        url: data.url,
        status: data.status,
        responseText: data.responseText,
        timestamp: data.timestamp || new Date().toISOString(),
        id: Date.now() + Math.random() // ユニークID
      };

      // 最新100件まで保存（メモリ節約）
      existingResponses.push(newResponse);
      if (existingResponses.length > 100) {
        existingResponses.shift(); // 古いものから削除
      }

      chrome.storage.local.set({
        networkResponses: existingResponses
      }, () => {
        console.log('Raw network data stored:', existingResponses.length, 'responses');
      });
    });
  } catch (error) {
    console.error('Error storing raw network data:', error);
  }
}

// ネットワークデータの処理と解析
function processNetworkData(data, tab) {
  try {
    console.log('Processing network data from URL:', data.url);

    // レスポンスデータの解析
    const orders = parseAmazonApiResponse(data);

    if (orders && orders.length > 0) {
      console.log('Parsed orders from network data:', orders.length);

      // 既存のストレージデータと結合
      chrome.storage.local.get(['amazonOrders'], (result) => {
        const existingOrders = result.amazonOrders || [];
        const allOrders = [...existingOrders, ...orders];

        // 重複除去
        const uniqueOrders = deduplicateOrders(allOrders);

        chrome.storage.local.set({
          amazonOrders: uniqueOrders,
          lastExtracted: new Date().toISOString(),
          lastNetworkExtraction: new Date().toISOString()
        }, () => {
          console.log('Network-extracted orders saved:', uniqueOrders.length);

          // ポップアップに通知
          chrome.runtime.sendMessage({
            action: 'extraction_complete',
            ordersCount: orders.length,
            totalOrders: uniqueOrders.length,
            source: 'network'
          }).catch(() => {
            console.log('Could not send message to popup');
          });
        });
      });
    }
  } catch (error) {
    console.error('Error processing network data:', error);
  }
}

// Amazon APIレスポンスの解析
function parseAmazonApiResponse(data) {
  const orders = [];

  try {
    let responseData = data.responseText || data.response;

    if (typeof responseData === 'string') {
      // JSONレスポンスの場合
      if (responseData.trim().startsWith('{') || responseData.trim().startsWith('[')) {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          console.log('Failed to parse as JSON, trying as text');
        }
      }
    }

    // Amazon特有のレスポンス構造を解析
    if (typeof responseData === 'object') {
      // 一般的なAmazon APIレスポンス構造
      const possibleOrdersPaths = [
        'orders',
        'orderHistory',
        'results',
        'data.orders',
        'payload.orders',
        'content.orders',
        'orderDetails',
        'shipments'
      ];

      let foundOrders = null;
      for (const path of possibleOrdersPaths) {
        foundOrders = getNestedProperty(responseData, path);
        if (foundOrders && Array.isArray(foundOrders)) {
          break;
        }
      }

      if (foundOrders && Array.isArray(foundOrders)) {
        console.log('Found orders array in response:', foundOrders.length);

        foundOrders.forEach(order => {
          const parsedOrder = parseOrderFromApiData(order);
          if (parsedOrder) {
            orders.push(parsedOrder);
          }
        });
      }
    }

    // HTMLレスポンスの場合（フォールバック）
    if (typeof responseData === 'string' && responseData.includes('<')) {
      console.log('Parsing HTML response for order data');
      // HTMLから構造化データを抽出
      const htmlOrders = parseOrdersFromHtml(responseData);
      orders.push(...htmlOrders);
    }

  } catch (error) {
    console.error('Error parsing Amazon API response:', error);
  }

  return orders;
}

// ネストされたオブジェクトプロパティの取得
function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

// APIデータから注文情報を解析
function parseOrderFromApiData(orderData) {
  try {
    const order = {
      orderId: orderData.orderId || orderData.orderNumber || orderData.id || 'N/A',
      orderDate: orderData.orderDate || orderData.date || orderData.placedDate || 'N/A',
      price: orderData.total || orderData.price || orderData.amount || '',
      status: orderData.status || orderData.deliveryStatus || '',
      products: [],
      extractedAt: new Date().toISOString(),
      source: 'network_api'
    };

    // 商品情報の抽出
    const possibleProductsPaths = [
      'items',
      'products',
      'orderItems',
      'lineItems',
      'shipmentItems'
    ];

    let products = null;
    for (const path of possibleProductsPaths) {
      products = orderData[path];
      if (products && Array.isArray(products)) {
        break;
      }
    }

    if (products && Array.isArray(products)) {
      products.forEach(product => {
        const productInfo = {
          name: product.title || product.name || product.productName || '',
          url: product.url || product.detailPageURL || '',
          image: product.image || product.imageUrl || product.thumbnail || '',
          price: product.price || product.unitPrice || '',
          quantity: product.quantity || 1
        };

        if (productInfo.name) {
          order.products.push(productInfo);
        }
      });
    }

    order.productCount = order.products.length;

    return order.orderId !== 'N/A' || order.products.length > 0 ? order : null;

  } catch (error) {
    console.error('Error parsing order from API data:', error);
    return null;
  }
}

// HTMLレスポンスから注文情報を抽出（フォールバック）
function parseOrdersFromHtml(html) {
  // 基本的なHTMLパース（DOMParserは background scriptでは使用不可）
  const orders = [];

  try {
    // 正規表現でJSON埋め込みデータを探す
    const jsonMatches = html.match(/(?:window\.|var\s+)[\w_]+\s*=\s*(\{.*?\});/gs);

    if (jsonMatches) {
      jsonMatches.forEach(match => {
        try {
          const jsonStart = match.indexOf('{');
          const jsonStr = match.substring(jsonStart, match.lastIndexOf(';'));
          const data = JSON.parse(jsonStr);

          // JSONデータから注文情報を抽出
          const extractedOrders = parseAmazonApiResponse({ response: data });
          orders.push(...extractedOrders);
        } catch (e) {
          // JSON解析失敗は無視
        }
      });
    }
  } catch (error) {
    console.error('Error parsing orders from HTML:', error);
  }

  return orders;
}

// 注文の重複除去
function deduplicateOrders(orders) {
  const seen = new Set();
  return orders.filter(order => {
    const key = order.orderId !== 'N/A' ?
      order.orderId :
      `${order.orderDate}_${order.products.map(p => p.name).join('_')}`;

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

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