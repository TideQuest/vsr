document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    checkCurrentPage();

    // 現在のページ情報を取得
    function checkCurrentPage() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            const url = currentTab.url;
            document.getElementById('current-url').textContent = url;

            if (url.includes('amazon') && url.includes('order-history')) {
                document.getElementById('extraction-status').textContent = 'Amazon注文履歴ページ検出';
                document.getElementById('extraction-status').className = 'success';
            } else if (url.includes('amazon')) {
                document.getElementById('extraction-status').textContent = 'Amazonサイト検出（注文履歴ページに移動してください）';
                document.getElementById('extraction-status').className = 'loading';
            } else {
                document.getElementById('extraction-status').textContent = 'Amazonサイトではありません';
                document.getElementById('extraction-status').className = 'error';
            }
        });
    }

    // 統計情報を更新
    function updateStats() {
        chrome.storage.local.get(['amazonOrders', 'lastExtracted'], function(result) {
            const orders = result.amazonOrders || [];
            const lastExtracted = result.lastExtracted;

            document.getElementById('orders-count').textContent = orders.length;

            if (lastExtracted) {
                const date = new Date(lastExtracted);
                document.getElementById('last-extracted').textContent =
                    date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP');
            }
        });
    }

    // 購入履歴抽出ボタン
    document.getElementById('extract-btn').addEventListener('click', function() {
        const button = this;
        button.disabled = true;
        button.textContent = '抽出中...';

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('amazon')) {
                alert('Amazonサイトで実行してください');
                button.disabled = false;
                button.textContent = '購入履歴を抽出';
                return;
            }

            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                function: extractPurchaseHistoryFromPage
            }, function(results) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    alert('抽出に失敗しました: ' + chrome.runtime.lastError.message);
                } else {
                    console.log('Extraction completed');
                }

                button.disabled = false;
                button.textContent = '購入履歴を抽出';
                updateStats();
            });
        });
    });

    // データ表示ボタン
    document.getElementById('view-data-btn').addEventListener('click', function() {
        const dataSection = document.getElementById('data-section');
        const ordersList = document.getElementById('orders-list');

        if (dataSection.style.display === 'none') {
            chrome.storage.local.get(['amazonOrders'], function(result) {
                const orders = result.amazonOrders || [];

                if (orders.length === 0) {
                    ordersList.innerHTML = '<p>抽出されたデータがありません</p>';
                } else {
                    ordersList.innerHTML = orders.map(order => `
                        <div class="order-item">
                            <div class="order-header">
                                注文ID: ${order.orderId || 'N/A'} |
                                日付: ${order.orderDate || 'N/A'}
                            </div>
                            <div>価格: ${order.price || 'N/A'}</div>
                            <div>状況: ${order.status || 'N/A'}</div>
                            <div>商品数: ${order.products.length}</div>
                            ${order.products.map(product => `
                                <div class="product-item">${product.name}</div>
                            `).join('')}
                        </div>
                    `).join('');
                }

                dataSection.style.display = 'block';
                this.textContent = 'データを隠す';
            });
        } else {
            dataSection.style.display = 'none';
            this.textContent = '抽出データを表示';
        }
    });

    // エクスポートボタン
    document.getElementById('export-btn').addEventListener('click', function() {
        chrome.storage.local.get(['amazonOrders'], function(result) {
            const orders = result.amazonOrders || [];

            if (orders.length === 0) {
                alert('抽出されたデータがありません');
                return;
            }

            const dataStr = JSON.stringify(orders, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `amazon-purchase-history-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
        });
    });

    // データクリアボタン
    document.getElementById('clear-btn').addEventListener('click', function() {
        if (confirm('すべての抽出データを削除しますか？')) {
            chrome.storage.local.clear(function() {
                alert('データをクリアしました');
                updateStats();
                document.getElementById('data-section').style.display = 'none';
                document.getElementById('view-data-btn').textContent = '抽出データを表示';
            });
        }
    });

    // メッセージリスナー
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'extraction_complete') {
            updateStats();
            document.getElementById('extraction-status').textContent =
                `抽出完了: ${request.ordersCount}件の新しい注文`;
            document.getElementById('extraction-status').className = 'success';
        }
    });
});

// ページから購入履歴を抽出する関数（content scriptに注入）
function extractPurchaseHistoryFromPage() {
    function extractPurchaseHistory() {
        const orders = [];

        // Amazon の注文履歴ページから情報を抽出
        const orderElements = document.querySelectorAll('[data-order-id], .order-card, .a-box-group, .shipment, .order, .order-info');

        orderElements.forEach((element, index) => {
            try {
                // 注文日を取得 - より包括的なセレクター
                let orderDate = '';
                const dateSelectors = [
                    '.order-info .a-color-secondary',
                    '.delivery-box .a-color-secondary',
                    '[data-test-id="order-date"]',
                    '.a-row .a-color-secondary',
                    '.order-header .a-color-secondary',
                    '.byo-order-details .a-color-secondary',
                    '.shipment-top-row .a-color-secondary'
                ];

                for (const selector of dateSelectors) {
                    const dateElement = element.querySelector(selector);
                    if (dateElement && dateElement.textContent) {
                        const text = dateElement.textContent.trim();
                        // 日付らしきパターンを探す
                        const dateMatch = text.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]+ \d{1,2}, \d{4})/);
                        if (dateMatch) {
                            orderDate = dateMatch[1];
                            break;
                        }
                    }
                }

                // 注文ID を取得 - より包括的な検索
                let orderId = '';
                const orderIdSelectors = [
                    '[data-order-id]',
                    '.byo-order-details .a-color-secondary',
                    '.order-info .a-color-secondary',
                    '.order-header .a-color-secondary'
                ];

                // data-order-id属性から取得
                const orderIdElement = element.querySelector('[data-order-id]');
                if (orderIdElement) {
                    orderId = orderIdElement.getAttribute('data-order-id') || '';
                }

                // テキストから注文番号を抽出
                if (!orderId) {
                    for (const selector of orderIdSelectors) {
                        const idElement = element.querySelector(selector);
                        if (idElement && idElement.textContent) {
                            const text = idElement.textContent;
                            const idMatch = text.match(/(?:注文番号|Order #|注文ID)[:\s]*([A-Z0-9-]{10,})/i);
                            if (idMatch) {
                                orderId = idMatch[1];
                                break;
                            }
                        }
                    }
                }

                // 商品情報を取得
                const productElements = element.querySelectorAll('.a-row .a-link-normal, .product-image a, .a-link-normal[href*="/dp/"], .item-view-container');
                const products = [];

                productElements.forEach(productElement => {
                    const productName = productElement.textContent?.trim() ||
                                       productElement.querySelector('img')?.alt || '';
                    const productUrl = productElement.href || '';
                    const productImage = productElement.querySelector('img')?.src || '';

                    if (productName && productName.length > 0) {
                        products.push({
                            name: productName,
                            url: productUrl,
                            image: productImage
                        });
                    }
                });

                // 価格情報を取得
                const priceElement = element.querySelector('.a-price .a-price-whole, .a-price-amount, .a-size-base.a-color-price');
                const price = priceElement ? priceElement.textContent.trim() : '';

                // 配送状況を取得
                const statusElement = element.querySelector('.a-color-success, .a-color-state, .delivery-box span');
                const status = statusElement ? statusElement.textContent.trim() : '';

                if (orderId || products.length > 0 || orderDate) {
                    orders.push({
                        orderId: orderId,
                        orderDate: orderDate,
                        products: products,
                        price: price,
                        status: status,
                        extractedAt: new Date().toISOString()
                    });
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
                    console.log('Could not send message');
                });
            });
        });
    }

    // 抽出実行
    const orders = extractPurchaseHistory();
    console.log('Extracted orders:', orders.length);

    if (orders.length > 0) {
        saveToStorage(orders);
        return { success: true, ordersCount: orders.length };
    } else {
        console.log('No orders found on this page');
        return { success: false, message: 'このページで注文が見つかりませんでした' };
    }
}