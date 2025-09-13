document.addEventListener('DOMContentLoaded', function() {
    // 現在のタブ情報を取得
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        document.getElementById('current-url').textContent = currentTab.url;
        document.getElementById('current-title').textContent = currentTab.title;
    });

    // 背景色変更ボタンのイベントリスナー
    document.getElementById('change-color-btn').addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: changeBackgroundColor
            });
        });
    });

    // アラートボタンのイベントリスナー
    document.getElementById('alert-btn').addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: showAlert
            });
        });
    });
});

// ページの背景色をランダムに変更する関数
function changeBackgroundColor() {
    const colors = ['#ffcccb', '#add8e6', '#90ee90', '#ffb6c1', '#dda0dd', '#f0e68c'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.backgroundColor = randomColor;
}

// アラートを表示する関数
function showAlert() {
    alert('Hello from Chrome Extension!');
}