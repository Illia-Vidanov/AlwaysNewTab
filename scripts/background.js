// Update on extension load
Check();

const NEW_TAB_URL = "chrome://newtab/";
var next_moved_tabs_ignore = 0;

// Check if tab was removed
chrome.tabs.onRemoved.addListener((tab_id, removeInfo) => {
  Check();
});

// Check if url changed
chrome.tabs.onUpdated.addListener((tab_id, change_info, tab) => {
  if(change_info.url)
    Check();
});

// Check if tab is moved
chrome.tabs.onMoved.addListener((tab_id, move_info) => {
  if(next_moved_tabs_ignore > 0)
  {
    next_moved_tabs_ignore--;
    return;
  }

  Check();
});

// Check if new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  Check();
});

// Check if tab was attached
chrome.tabs.onAttached.addListener((tab_id, attach_info) => {
  Check();
});

// Check if tab was detached
chrome.tabs.onDetached.addListener((tab_id, detach_info) => {
  Check();
});


// Popup refresh message
chrome.runtime.onMessage.addListener((request, sender, send_response) => {
   if(request.msg == "Check")
     Check();
});

async function Check()
{
  if(!await chrome.storage.sync.get({"enabled": true}))
    return;
  
  for(const window of await chrome.windows.getAll({windowTypes: ['normal']}))
  {
    // Normal check
    const active_tabs = await chrome.tabs.query({windowId: window.id, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE, active: true});
    var found = active_tabs.length > 0 ? (active_tabs[0].url == NEW_TAB_URL) : false;

    if(found && await chrome.storage.sync.get({"move": true}))
      await MoveTab(active_tabs[0].id, window.id);

    const tabs = await chrome.tabs.query({windowId: window.id, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE, active: false});
    for(const tab of tabs){
      if(tab.url == NEW_TAB_URL && !tab.pinned){
        // Move new tabs forward
        if(await chrome.storage.sync.get({"move": true}))
          await MoveTab(tab.id, window.id);
        
        // Close if it's not first new tab
        if(found)
          await RemoveTab(tab.id);
    
        found = true;
      }
    }
    
    if(!found)
      await CreateNewTab(window.id);
    
    
    // Group check
    if(chrome.storage.sync.get({"group": true}))
    {
      for(const group of await chrome.tabGroups.query({})){
        const active_tabs = await chrome.tabs.query({windowId: window.id, groupId: group.id, active: true});
        var found = active_tabs.length > 0 ? (active_tabs[0].url == NEW_TAB_URL) : false;
        
        if(found && await chrome.storage.sync.get({"move": true}))
          await MoveTabInGroup(active_tabs[0].id, window.id, group.id);

        const tabs = await chrome.tabs.query({windowId: window.id, groupId: group.id, active: false});  
        for(const tab of tabs){
          if(tab.url == NEW_TAB_URL){
            // Move new tabs forward
            // Check for amount of tabs to avoid moving the group
            if(await chrome.storage.sync.get({"move": true}) && tabs.length > 2)
              await MoveTabInGroup(tab.id, window.id, group.id);
          };
            
          // Close if it's not first new tab
          if(found)
            await RemoveTab(tab.id);
          
          found = true;
        }

        if(!found)
          await CreateNewTabInGroup(window.id, group.id);
      }
    }
  }
}

async function MoveTab(tab_id, window_id)
{
  chrome.tabs.move(tab_id, {index: -1, windowId: window_id}, (tab) => {
    if(chrome.runtime.lastError)
    {
      // Despite it isn't recomended to use setTimout here it doesn't do a lot of important stuff so I guess it's valid
      setTimeout(() => MoveTab(tab_id, window_id), 100);
      return;
    }

    next_moved_tabs_ignore++;
  });
}

async function MoveTabInGroup(tab_id, window_id, group_id)
{
  chrome.tabs.move(tab_id, {index: -1, windowId: window_id}, () => {
    if(chrome.runtime.lastError)
    {
      // Despite it isn't recomended to use setTimout here it doesn't do a lot of important stuff so I guess it's valid
      setTimeout(() => MoveTabInGroup(tab_id, window_id, group_id), 100);
      return;
    }
    
    chrome.tabs.group({tabIds: tab_id, groupId: group_id});
    next_moved_tabs_ignore += 2;
  });
}

async function RemoveTab(tab_id)
{
  chrome.tabs.remove(tab_id, () => { if(chrome.runtime.lastError) return; });
}

async function CreateNewTab(window_id)
{
  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, () => {
    if(chrome.runtime.lastError)
    {
      setTimeout(() => CreateNewTab(window_id), 100);
      return;
    }
  });
}

async function CreateNewTabInGroup(window_id, group_id)
{
  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, () => {
    if(chrome.runtime.lastError)
    {
      setTimeout(() => CreateNewTabInGroup(window_id, group_id), 100);
      return;
    }

    chrome.tabs.group({tabIds: new_tab.id, groupId: group_id, windowID: window_id});
  });
}