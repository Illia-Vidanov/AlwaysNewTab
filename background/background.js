import { GetStorageChache, SwapArrayElements, enum_value } from "../scripts/common.js"

const NEW_TAB_URL = Object.freeze("chrome://newtab/");
let active_tab = -1;
let is_moving = false;
let is_creating = false;
let is_detached = false;
let is_attached = false;
let ignore_moved = 0;
let ignore_removed = 0;
let last_created_tabs = new Map();

// Change active tab when active is changed
chrome.tabs.onActivated.addListener((activeInfo) => {
  active_tab = activeInfo.tabId;
});

// Check if tab was removed
chrome.tabs.onRemoved.addListener((tab_id, removeInfo) => {
  if(ignore_removed > 0)
  {
    ignore_removed--;
    return;
  }

  console.log("Check remove");
  Check(removeInfo.windowId, tab_id == active_tab);
});

// Check if url changed
chrome.tabs.onUpdated.addListener((tab_id, change_info, tab) => {
  if(change_info.url && tab.active)
  {
    console.log("Check url change");
    Check(tab.windowId);
  }
});

// Check if tab is moved
chrome.tabs.onMoved.addListener((tab_id, move_info) => {
  if(is_moving)
    return;

  if(ignore_moved > 0) {
    ignore_moved--;
    return;
  }

  console.log("Check moved");
  Check(move_info.windowId);
});

// Check if new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  console.log("Check created");
  Check(tab.windowId);
});

// Check if tab was attached
chrome.tabs.onAttached.addListener((tab_id, attach_info) => {
  console.log("Check attached");
  is_attached = true;
  Check(attach_info.newWindowId);
});

// Check if tab was detached
chrome.tabs.onDetached.addListener(async (tab_id, detach_info) => {
  console.log("Check detached");
  is_detached = true;
  Check(detach_info.oldWindowId);
});

// Update on extension load
async function CheckCurrentWindow(){
  // Wrote this way because chrome API is very limiting when it comes to popups
  console.log("Check current window")
  Check((await chrome.tabs.query({active: true}))[0].windowId);
}
CheckCurrentWindow();

// Popup refresh message
chrome.runtime.onMessage.addListener((request, sender, send_response) => {
  console.log("Check message");
  if(request.msg == "Check")
    CheckCurrentWindow();
});

async function Check(win_id, removed_active){
  if(!win_id)
    return;

  try {
    await chrome.windows.get(win_id);
  }
  catch(error) {
    return;
  }
  
  let storage_cache = {};
  try {
    storage_cache = await GetStorageChache();
  }
  catch(error){
    console.error(error.message);
    return;
  }

  if(!storage_cache || !storage_cache.enabled)
    return;

  const tab_count = (await chrome.tabs.query({windowId: win_id})).length;

  // Normal check
  {
    const tabs = await chrome.tabs.query({windowId: win_id, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE});
    
    let active_tab_index = tabs.findIndex((tab) => tab.active == true);
    if(active_tab_index != -1)
      SwapArrayElements(tabs, 0, active_tab_index);
    
    let found = false;

    for(const tab of tabs){
      if((tab.url == NEW_TAB_URL || tab.pendingUrl == NEW_TAB_URL) && !tab.pinned){
        if(storage_cache.close && found)
        {
          await RemoveTab(tab);
          continue;
        }
        
        if(storage_cache.move && !found && tab.index != (tab_count - 1))
          await MoveTab(tab, win_id);
    
        found = true;
      }
    }
    
    if(!found && !is_creating){
      await CreateNewTab(win_id, (new_tab) => {
        if(removed_active)
          chrome.tabs.update(new_tab.id, { active: true });
      });
    }
  }
  
  
  // Group check
  if(storage_cache.group){
    for(const group of await chrome.tabGroups.query({})){
      const tabs = await chrome.tabs.query({windowId: win_id, groupId: group.id});

      if(tabs.length == 0)
        continue;
      
      let active_tab_index = tabs.findIndex((tab) => tab.active == true);
      if(active_tab_index != -1)
        SwapArrayElements(tabs, 0, active_tab_index);
      
      let last_tab_index = tabs[0].index;
      for(const tab of tabs){
        last_tab_index = Math.max(tab.index, last_tab_index);
      }
      
      let found = false;

      for(const tab of tabs){

        if(tab.url == NEW_TAB_URL || tab.pendingUrl == NEW_TAB_URL){
          if(storage_cache.close && found)
          {
            await RemoveTab(tab);
            continue;
          }

          // Check for amount of tabs to avoid moving the group
          if(storage_cache.move && !found && tab.index != last_tab_index)
            await MoveTabInGroup(tab, win_id, group.id);
          
          found = true;
        }
      }

      if(!found && !is_moving && !is_creating)
      {
        await CreateNewTabInGroup(win_id, group.id, (new_tab) => {
          if(removed_active)
            chrome.tabs.update(new_tab.id, { active: true });
        });
      }
    }
  }
}

async function MoveTab(tab, window_id){
  console.log("Move tab");

  //if(is_detached)
  //{
  //  is_detached = false;
  //  is_moving = false;
  //  return;
  //}

  is_moving = true;
    
  chrome.tabs.move(tab.id, {index: -1, windowId: window_id}, () => {
    if(chrome.runtime.lastError){
      setTimeout(() => MoveTab(tab, window_id), 100);
      return;
    }

    is_moving = false;
  });
}

async function MoveTabInGroup(tab, window_id, group_id){
  console.log("Move tab");

  //if(is_detached){
  //  is_detached = false;
  //  is_moving = false;
  //  return;
  //}
  
  is_moving = true;

  chrome.tabs.move(tab.id, {index: -1, windowId: window_id}, async () => {
    if(chrome.runtime.lastError){
      setTimeout(() => MoveTabInGroup(tab, window_id, group_id), 100);
      return;
    }
    await chrome.tabs.group({tabIds: tab.id, groupId: group_id});
    ignore_moved++;
    is_moving = false;
  });
}

async function RemoveTab(tab){
  console.log("Remove tab");

  //if(is_attached){
  //  is_attached = false;
  //  return;
  //}
//
  //if(is_detached){
  //  is_detached = false;
  //  return;
  //}

  await chrome.tabs.remove(tab.id, () => { if(chrome.runtime.lastError) return; });
}

async function CreateNewTab(window_id, callback)
{
  console.log("Create tab");

  //if(is_attached){
  //  is_attached = false;
  //  return;
  //}

  is_creating = true;
  
  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, (new_tab) => {
    if(chrome.runtime.lastError){
      setTimeout(() => CreateNewTab(window_id, callback), 100);
      return;
    }

    is_creating = false;

    last_created_tabs.set(chrome.tabGroups.TAB_GROUP_ID_NONE, new_tab.id);

    callback(new_tab);
  });
}

async function CreateNewTabInGroup(window_id, group_id, callback)
{
  console.log("Create tab");

  //if(is_attached){
  //  is_attached = false;
  //  return;
  //}

  is_creating = true;

  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, async (new_tab) => {
    if(chrome.runtime.lastError){
      setTimeout(() => CreateNewTabInGroup(window_id, group_id, callback), 100);
      return;
    }

    await chrome.tabs.group({tabIds: new_tab.id, groupId: group_id});
    ignore_moved++;

    is_creating = false;

    last_created_tabs.set(group_id, new_tab.id);

    callback(new_tab);
  });
}