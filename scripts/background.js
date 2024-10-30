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
    
    // Normal check
    chrome.tabs.query({windowType:'normal', groupId:chrome.tabGroups.TAB_GROUP_ID_NONE}, function(tabs){
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
        chrome.tabs.create({ url: "chrome://newtab/", active: false }, function(new_tab){});
    });
    
    
    // Group check
    chrome.storage.sync.get("group", function(data){
      if(!data.group)
        return;
      
      chrome.tabGroups.query({}, function(groups){
        if(!groups)
          return;
        
        for(const group of groups)
        {
          chrome.tabs.query({windowType:'normal', groupId:group.id}, function(tabs){
            var found = false;
            for(const tab of tabs)
            {
              if(tab.url == "chrome://newtab/")
              {
                // Move new tabs forward
                chrome.storage.sync.get("move", function(data){
                  // Check for amount of tabs to avoid moving the group
                  if(data.move && tabs.length > 2)
                  {
                    chrome.tabs.move(tab.id, { index: -1 });
                    chrome.tabs.group({tabIds: tab.id, groupId: group.id});                    
                  }
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
            {
              chrome.tabs.create({ url: "chrome://newtab/", active: false }, function(new_tab){
                chrome.tabs.group({tabIds: new_tab.id, groupId: group.id});
              });
            }
          });
        }
      });
    });
  });
}