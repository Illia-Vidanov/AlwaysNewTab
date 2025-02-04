chrome.tabs.onRemoved.addListener(OnRemoved);
chrome.tabs.onUpdated.addListener(OnUpdated);

chrome.runtime.onMessage.addListener(
function(request, sender, sendResponse)
{
    if(request.msg == "Check") Check();
});

function OnRemoved(tabId, removeInfo)
{
	Check();
}

function OnUpdated(tabId, changeInfo, tab)
{
	if(changeInfo.url)
		Check();
}

function Check()
{
	chrome.storage.sync.get("enabled",
	function(data)
	{
		if(!data.enabled)
			return;
		
		chrome.windows.getCurrent(
		function(window)
		{
			while(chrome.runtime.lastError)
			{
				setTimeout(Check, 100);
			}

			if(window.type != "normal")
				return;

			chrome.tabs.query({ currentWindow: true },
			function(tabs)
			{
				// Querry tabs to check if there is new tab
				var found = false;
				for(const tab of tabs)
				{
					if(tab.url == "chrome://newtab/" && !tab.pinned)
					{
						// move new tabs forward
						chrome.storage.sync.get("move",
						function(data)
						{
							if(data.move)
								chrome.tabs.move(tab.id, { index: -1 });
						});
						
						// Close if it's not first new tab
						if(found)
						{
							chrome.storage.sync.get("close",
							function(data)
							{
								if(data.close)
									chrome.tabs.remove(tab.id);	
							});
						}
		
						found = true;
					}
				}
				
				if(!found)
				{
					chrome.tabs.create({ url: "chrome://newtab/", active: false }, function (newTab) {});
				}
			});
		});
	});
}