chrome.action.onClicked.addListener(function (tab) {
    //console.log('onClicked')
    chrome.tabs.create({
        'url': chrome.runtime.getURL("player.html"),
    });
});

const rules = {
    removeRuleIds: [1,2,3],
    addRules: [{
        id: 1,
        priority: 1,
        condition: {
            domainType: 'thirdParty',
            urlFilter: 'https://api.bilibili.com/x/click-interface/click/web/h5',
        },
        action: {
            type: "modifyHeaders",
            requestHeaders: [
                {
                    header: "origin",
                    operation: "set",
                    value: "https://www.bilibili.com"
                },
            ],
        }
    }, {
        id: 2,
        priority: 1,
        condition: {
            domainType: 'thirdParty',
            urlFilter: 'https://api.bilibili.com/x/space/wbi/arc/search',
        },
        action: {
            type: "modifyHeaders",
            requestHeaders: [
                {
                    header: "Referer",
                    operation: "set",
                    value: "https://space.bilibili.com/283886865"
                },
            ],
        }
    }, {
        id: 3,
        priority: 1,
        condition: {
            domainType: 'thirdParty',
            urlFilter: 'https://api.bilibili.com/x/click-interface/click/web/h5',
        },
        action: {
            type: "modifyHeaders",
            requestHeaders: [
                {
                    header: "Referer",
                    operation: "set",
                    value: "https://www.bilibili.com/video/BV17x411w7KC/"
                },
            ],
        }
    }]
}

const modifyHeaderIfNecessary = () =>  {
    chrome.declarativeNetRequest.updateDynamicRules(rules, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        } else {
            chrome.declarativeNetRequest.getDynamicRules(rules => console.log(rules));
        }
    });
}

chrome.runtime.onInstalled.addListener(function() {
    console.log("Extension installed");
    modifyHeaderIfNecessary()
});

