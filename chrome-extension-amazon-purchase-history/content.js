function extractPurchaseHistory() {
  const orders = [];

  // より具体的なAmazon注文履歴のセレクター
  const orderSelectors = [
    // 注文カード全体
    '.order',
    '.shipment',
    '[data-order-id]',
    '.order-card',
    '.a-box-group[data-a-accordion-name]',
    '#orderDetails',
    '.orderCardDeliveryBox',
    '.yo-critical-feature',
    // フォールバック: より一般的なコンテナ
    '.a-box-group',
    '.a-section'
  ];

  let orderElements = [];
  for (const selector of orderSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      orderElements = Array.from(elements);
      console.log(`Found ${elements.length} elements with selector: ${selector}`);
      break;
    }
  }

  // 既存のセレクターでも試してみる
  if (orderElements.length === 0) {
    orderElements = Array.from(document.querySelectorAll('div'));
    console.log('Fallback to all div elements:', orderElements.length);
  }

  orderElements.forEach((element, index) => {
    try {
      // スケルトン要素をスキップ
      if (element.classList.contains('skeleton') ||
          element.querySelector('.skeleton') ||
          element.textContent.trim().length < 10) {
        return;
      }

      // 注文日を取得 - より包括的なセレクター
      let orderDate = '';
      const dateSelectors = [
        // 注文日付の一般的なセレクター
        '.order-date',
        '.order-info .a-color-secondary',
        '.delivery-box .a-color-secondary',
        '[data-test-id="order-date"]',
        '.a-row .a-color-secondary',
        '.order-header .a-color-secondary',
        '.byo-order-details .a-color-secondary',
        '.shipment-top-row .a-color-secondary',
        // より広範囲で日付を探す
        '.a-color-secondary',
        '.a-color-base'
      ];

      for (const selector of dateSelectors) {
        const dateElements = element.querySelectorAll(selector);
        for (const dateElement of dateElements) {
          if (dateElement && dateElement.textContent) {
            const text = dateElement.textContent.trim();
            // 日付らしきパターンを探す（日本語と英語両対応）
            const dateMatch = text.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Za-z]+ \d{4})/);
            if (dateMatch) {
              orderDate = dateMatch[1];
              break;
            }
          }
        }
        if (orderDate) break;
      }

      // 注文ID を取得
      let orderId = '';

      // data-order-id属性から取得
      const orderIdElement = element.querySelector('[data-order-id]') || element.closest('[data-order-id]');
      if (orderIdElement) {
        orderId = orderIdElement.getAttribute('data-order-id') || '';
      }

      // テキストから注文番号を抽出
      if (!orderId) {
        const allText = element.textContent || '';
        const idMatches = [
          /(?:注文番号|Order #|注文ID|Order ID)[:\s]*([A-Z0-9-]{10,})/i,
          /([A-Z0-9]{3}-[A-Z0-9]{7}-[A-Z0-9]{7})/i,  // Amazon注文番号パターン
          /#([A-Z0-9-]{10,})/i
        ];

        for (const pattern of idMatches) {
          const match = allText.match(pattern);
          if (match) {
            orderId = match[1];
            break;
          }
        }
      }

      // 商品情報を取得 - より包括的なセレクター
      const productSelectors = [
        // 商品リンク
        'a[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        '.a-link-normal[href*="/dp/"]',
        '.product-image a',
        '.a-link-normal',
        // 商品名のテキスト要素
        '.a-size-medium.a-link-normal',
        '.a-size-base-plus',
        '.a-size-base a',
        // より一般的なリンク
        'a[title]',
        'a img[alt]'
      ];

      const products = [];
      const seenProducts = new Set();

      for (const selector of productSelectors) {
        const productElements = element.querySelectorAll(selector);

        productElements.forEach(productElement => {
          let productName = '';

          // 商品名の取得方法を複数試す
          if (productElement.textContent && productElement.textContent.trim().length > 5) {
            productName = productElement.textContent.trim();
          } else if (productElement.title) {
            productName = productElement.title.trim();
          } else if (productElement.querySelector('img')?.alt) {
            productName = productElement.querySelector('img').alt.trim();
          }

          const productUrl = productElement.href || '';
          const productImage = productElement.querySelector('img')?.src || '';

          // 有効な商品名かチェック
          if (productName &&
              productName.length > 5 &&
              !seenProducts.has(productName) &&
              !productName.includes('注文内容を表示') &&
              !productName.includes('詳細を表示') &&
              !/^[0-9\s¥,]+$/.test(productName)) {

            seenProducts.add(productName);
            products.push({
              name: productName,
              url: productUrl,
              image: productImage
            });
          }
        });

        if (products.length > 0) break;
      }

      // 価格情報を取得 - より包括的
      let price = '';
      const priceSelectors = [
        '.a-price .a-price-whole',
        '.a-price-amount',
        '.a-size-base.a-color-price',
        '.a-price',
        '.price'
      ];

      for (const selector of priceSelectors) {
        const priceElement = element.querySelector(selector);
        if (priceElement && priceElement.textContent) {
          const priceText = priceElement.textContent.trim();
          if (priceText.includes('¥') || priceText.includes('$')) {
            price = priceText;
            break;
          }
        }
      }

      // テキスト全体から価格を抽出
      if (!price) {
        const allText = element.textContent || '';
        const priceMatch = allText.match(/¥[\d,]+/);
        if (priceMatch) {
          price = priceMatch[0];
        }
      }

      // 配送状況を取得
      const statusSelectors = [
        '.a-color-success',
        '.a-color-state',
        '.delivery-box span',
        '.shipment-status',
        '.order-status'
      ];

      let status = '';
      for (const selector of statusSelectors) {
        const statusElement = element.querySelector(selector);
        if (statusElement && statusElement.textContent) {
          status = statusElement.textContent.trim();
          break;
        }
      }

      // より良いフィルタリング条件
      const hasValidData = orderId ||
                          (products.length > 0) ||
                          (orderDate && price) ||
                          (element.textContent && element.textContent.length > 50);

      if (hasValidData) {
        const order = {
          orderId: orderId || 'N/A',
          orderDate: orderDate || 'N/A',
          products: products,
          price: price,
          status: status || 'N/A',
          productCount: products.length,
          extractedAt: new Date().toISOString()
        };

        console.log('Adding order:', {
          ...order,
          elementText: element.textContent?.substring(0, 200) + '...',
          elementClass: element.className,
          elementTag: element.tagName
        });
        orders.push(order);
      }
    } catch (error) {
      console.error('Error extracting order data:', error);
    }
  });

  return orders;
}

function saveToStorage(data) {
  chrome.storage.local.get(['amazonOrders'], function(result) {
    const existingOrders = result.amazonOrders || [];
    const allOrders = [...existingOrders, ...data];

    // 重複削除の改善：注文IDがある場合はそれで、ない場合は商品情報で判定
    const uniqueOrders = allOrders.filter((order, index, self) => {
      if (order.orderId && order.orderId.trim()) {
        // 注文IDがある場合はそれで重複チェック
        return index === self.findIndex(o => o.orderId === order.orderId);
      } else {
        // 注文IDがない場合は、日付と商品の組み合わせで重複チェック
        const orderKey = `${order.orderDate}_${order.products.map(p => p.name).join('_')}`;
        const existingKey = `${self[index].orderDate}_${self[index].products.map(p => p.name).join('_')}`;
        return index === self.findIndex(o => {
          const oKey = `${o.orderDate}_${o.products.map(p => p.name).join('_')}`;
          return oKey === orderKey;
        });
      }
    });

    console.log('Data to save:', data.length, 'orders');
    console.log('Existing orders:', existingOrders.length);
    console.log('After deduplication:', uniqueOrders.length);

    chrome.storage.local.set({
      amazonOrders: uniqueOrders,
      lastExtracted: new Date().toISOString()
    }, function() {
      console.log('Purchase history saved:', uniqueOrders.length, 'orders');

      // ポップアップに結果を送信
      chrome.runtime.sendMessage({
        action: 'extraction_complete',
        ordersCount: data.length,
        totalOrders: uniqueOrders.length
      }).catch(() => {
        // ポップアップが開いていない場合はエラーを無視
        console.log('Could not send message to popup');
      });
    });
  });
}

// 動的コンテンツの読み込み待機
function waitForContent(maxAttempts = 10, interval = 1000) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      console.log(`Attempt ${attempts}: Checking for content...`);

      // スケルトンではない実際のコンテンツがあるかチェック
      const nonSkeletonElements = document.querySelectorAll('div:not(.skeleton)');
      const hasRealContent = Array.from(nonSkeletonElements).some(el =>
        el.textContent &&
        el.textContent.trim().length > 50 &&
        !el.classList.contains('skeleton') &&
        !el.querySelector('.skeleton')
      );

      // Amazon特有の要素がロードされているかチェック
      const hasAmazonContent = document.querySelector('.a-price') ||
                              document.querySelector('[data-order-id]') ||
                              document.querySelector('.order') ||
                              document.querySelector('.shipment') ||
                              document.querySelectorAll('a[href*="/dp/"]').length > 0;

      console.log('Content check:', { hasRealContent, hasAmazonContent, attempts });

      if ((hasRealContent && hasAmazonContent) || attempts >= maxAttempts) {
        console.log('Content ready or max attempts reached');
        resolve();
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

// 改良された抽出実行関数
async function runExtraction() {
  console.log('Starting Amazon purchase history extraction...');

  // 動的コンテンツの読み込み待機
  await waitForContent();

  console.log('Content loaded, starting extraction...');
  const orders = extractPurchaseHistory();

  console.log(`Extracted ${orders.length} orders`);
  orders.forEach((order, index) => {
    console.log(`Order ${index + 1}:`, {
      orderId: order.orderId,
      date: order.orderDate,
      productCount: order.productCount,
      price: order.price,
      products: order.products.map(p => p.name.substring(0, 50))
    });
  });

  if (orders.length > 0) {
    saveToStorage(orders);
  } else {
    console.log('No orders found. Page might not be fully loaded or structure changed.');
    // デバッグ情報を出力
    console.log('Page analysis:');
    console.log('- Total divs:', document.querySelectorAll('div').length);
    console.log('- Skeleton elements:', document.querySelectorAll('.skeleton').length);
    console.log('- Amazon links:', document.querySelectorAll('a[href*="/dp/"]').length);
    console.log('- Price elements:', document.querySelectorAll('.a-price').length);
  }
}

// ネットワーク監視の設定 (Manifest v3対応、簡素化)
function setupNetworkInterception() {
  console.log('Setting up simplified network interception...');

  // XMLHttpRequestの傍受
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(data) {
    const xhr = this;
    const url = xhr.responseURL || this._url;

    xhr.addEventListener('load', function() {
      if (xhr.status === 200 && isAmazonOrderUrl(url)) {
        console.log('Amazon XHR intercepted:', url);

        setTimeout(() => {
          try {
            const responseData = {
              url: url,
              responseText: xhr.responseText,
              status: xhr.status,
              timestamp: new Date().toISOString()
            };

            chrome.runtime.sendMessage({
              action: 'network_data_captured',
              data: responseData
            }).catch(() => {});
          } catch (error) {
            console.error('Error processing XHR:', error);
          }
        }, 100);
      }
    });

    return originalXHRSend.apply(this, arguments);
  };

  // fetchの傍受
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    return originalFetch(url, options).then(response => {
      if (isAmazonOrderUrl(url) && response.ok) {
        console.log('Amazon fetch intercepted:', url);

        // 非同期でレスポンス処理
        response.clone().text().then(responseText => {
          try {
            const responseData = {
              url: url,
              responseText: responseText,
              status: response.status,
              timestamp: new Date().toISOString()
            };

            chrome.runtime.sendMessage({
              action: 'network_data_captured',
              data: responseData
            }).catch(() => {});
          } catch (error) {
            console.error('Error processing fetch:', error);
          }
        }).catch(() => {});
      }

      return response;
    });
  };
}

// Amazon注文関連のURLかチェック
function isAmazonOrderUrl(url) {
  if (!url) return false;

  const orderKeywords = [
    'order-history',
    'your-orders',
    'orders',
    'purchase',
    'shipment',
    'delivery',
    'order-details',
    'gp/your-account',
    'gp/css'
  ];

  const lowerUrl = url.toLowerCase();
  return orderKeywords.some(keyword => lowerUrl.includes(keyword)) &&
         (lowerUrl.includes('amazon.com') || lowerUrl.includes('amazon.co.jp') ||
          lowerUrl.includes('amazon.de') || lowerUrl.includes('amazon.fr') ||
          lowerUrl.includes('amazon.it') || lowerUrl.includes('amazon.es') ||
          lowerUrl.includes('amazon.co.uk'));
}

// 注入済みマーカー
window.amazonExtractorInjected = true;

// ネットワーク監視を開始
setupNetworkInterception();

// ページ読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runExtraction);
} else {
  runExtraction();
}

// メッセージリスナー
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extract_now') {
    console.log('Manual extraction triggered');
    runExtraction().then(() => {
      const orders = extractPurchaseHistory();
      sendResponse({success: true, ordersCount: orders.length});
    });
    return true; // 非同期レスポンスを示す
  }

  if (request.action === 'amazon_request_completed') {
    console.log('Amazon request completed notification from background:', request.url);
    // 追加の処理が必要な場合はここで実行
    sendResponse({success: true});
    return true;
  }

  if (request.action === 'start_network_monitoring') {
    console.log('Starting enhanced network monitoring...');
    setupNetworkInterception();
    sendResponse({success: true});
    return true;
  }
});

// ページ変更の監視
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed to:', url);
    if (url.includes('order-history') || url.includes('your-orders')) {
      console.log('Amazon order history page detected, running extraction...');
      setTimeout(runExtraction, 2000);
    }
  }
}).observe(document, {subtree: true, childList: true});