chrome.action.onClicked.addListener(function (tab) {
    //console.log('onClicked')
    chrome.tabs.create({
        'url': chrome.runtime.getURL("popup.html")
    });
});

chrome.runtime.onInstalled.addListener(function() {
    console.log("Extension installed");
});

