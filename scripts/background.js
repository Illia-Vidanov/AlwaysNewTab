// Check if tab was removed
chrome.tabs.onRemoved.addListener(OnRemoved);
function OnRemoved(tabId, removeInfo)
{
	Check();
}

// Check if url changed
chrome.tabs.onUpdated.addListener(OnUpdated);
function OnUpdated(tabId, changeInfo, tab)
{
	if(changeInfo.url)
		Check();
}

// Popup refresh message
chrome.runtime.onMessage.addListener(
function(request, sender, sendResponse)
{
    if(request.msg == "Check") Check();
});

function Check()
{
	chrome.storage.sync.get("enabled", function(data){
	if(!data.enabled)
		return;
	
	chrome.tabs.query({windowType:'normal'}, function(tabs){
	var found = false;
	for(const tab of tabs)
	{
		if(tab.url == "chrome://newtab/" && !tab.pinned)
		{
			// Move new tabs forward
			chrome.storage.sync.get("move", function(data){
				if(data.move)
					chrome.tabs.move(tab.id, { index: -1 });
			});
			
			// Close if it's not first new tab
			if(found)
			{
				chrome.storage.sync.get("close", function(data){
					if(data.close)
						chrome.tabs.remove(tab.id);	
				});
			}
	
			found = true;
		}
	}
	
	if(!found)
		chrome.tabs.create({ url: "chrome://newtab/", active: false }, function(newTab){});
	});
	});
}