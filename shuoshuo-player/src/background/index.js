chrome.action.onClicked.addListener(function (tab) {
    //console.log('onClicked')
    chrome.tabs.create({
        'url': chrome.runtime.getURL("player.html")
    });
});

chrome.runtime.onInstalled.addListener(function() {
    console.log("Extension installed");
});

