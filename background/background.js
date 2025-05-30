import { GetStorageChache, SwapArrayElements, enum_value } from "../scripts/common.js"

const NEW_TAB_URL = Object.freeze("chrome://newtab/");
// Used to track active tab so when it is being closed by the user and it was the only new tab, we could open new and make it active instead of other tab
let active_tab = -1;
// Used to indicate that there is an error occured in the process of creating tab and that there is no need to start new process because old one is not finished
let is_creating = false;
let is_creating_in_group = false;
// As is_creating used to not start new actions where the old one couldn't take place because of an error. No need for is_moving in group because we can move only one tab at a time
let is_moving = false;
// Used to recheck states and not to take wrong actions
let is_recheck_move = false;
let is_recheck_remove = false;
// Amount of actions of move should be ignored because we were the cause oof them. Used to reduce amount of checks. Might be buggy when a lot of actions happen at the same time with other extensions
let ignore_moved = 0;
// As ignore_moved used to decrease amount of useless checks
let ignore_removed = 0;

// Used to detect change in group ids
const last_check_group_ids = new Map();

// Change active tab when active is changed
chrome.tabs.onActivated.addListener((activeInfo) => {
  active_tab = activeInfo.tabId;
});

// Check if tab was removed
chrome.tabs.onRemoved.addListener((tab_id, removeInfo) => {
  last_check_group_ids.delete(tab_id);

  if(ignore_removed > 0)
  {
    ignore_removed--;
    return;
  }

  //console.log("Check remove");
  Check(removeInfo.windowId, tab_id == active_tab);
});

// Check if url changed
chrome.tabs.onUpdated.addListener((tab_id, change_info, tab) => {
  if(change_info.url && tab.active)
  {
    //console.log("Check url change");
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

  //console.log("Check moved");
  Check(move_info.windowId);
});

// Check if new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  //console.log("Check created");
  Check(tab.windowId);
});

// Check if tab was attached
chrome.tabs.onAttached.addListener((tab_id, attach_info) => {
  //console.log("Check attached");
  is_recheck_remove = true;
  setTimeout(() =>  Check(attach_info.newWindowId), 100);
});

// Check if tab was detached
chrome.tabs.onDetached.addListener((tab_id, detach_info) => {
  //console.log("Check detached");
  if(is_moving)
    is_recheck_move = true;
  is_recheck_remove = true;
  setTimeout(() =>  Check(detach_info.oldWindowId), 100);
});

// Update on extension load
async function CheckCurrentWindow(){
  // Wrote this way because chrome API is very limiting when it comes to popups
  //console.log("Check current window")
  let window_id = (await chrome.tabs.query({active: true}))[0].windowId;
  Check(window_id);
  DetectGroupChange(window_id);
}
CheckCurrentWindow();

// Popup refresh message
chrome.runtime.onMessage.addListener((request, sender, send_response) => {
  //console.log("Check message");
  if(request.msg == "Check")
    CheckCurrentWindow();
});

async function Check(window_id, removed_active){
  is_recheck_remove = false;

  if(!window_id)
    return;

  try {
    await chrome.windows.get(window_id);
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

  const move_right = storage_cache.move_dir == "right";
  const goal_index = move_right ? ((await chrome.tabs.query({windowId: window_id})).length - 1) : ((await chrome.tabs.query({windowId: window_id, pinned: true})).length);

  // Normal check
  {
    const tabs = await chrome.tabs.query({windowId: window_id, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE});
    
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
        
        if(storage_cache.move && !found && tab.index != goal_index && !is_moving)
          await MoveTab(tab, goal_index, window_id);
    
        found = true;
      }
    }
    
    if(!found && !is_creating){
      await CreateNewTab(window_id, (new_tab) => {
        if(removed_active)
          chrome.tabs.update(new_tab.id, { active: true });
      });
    }
  }
  
  
  // Group check
  if(storage_cache.group){
    for(const group of await chrome.tabGroups.query({})){
      const tabs = await chrome.tabs.query({windowId: window_id, groupId: group.id});

      if(tabs.length == 0)
        continue;
      
      let active_tab_index = tabs.findIndex((tab) => tab.active == true);
      if(active_tab_index != -1)
        SwapArrayElements(tabs, 0, active_tab_index);
      
      let group_goal_index = tabs[0].index;

      if(move_right)
      {
        for(const tab of tabs){
          group_goal_index = Math.max(tab.index, group_goal_index);
        }
      }
      else
      {
        for(const tab of tabs){
          group_goal_index = Math.min(tab.index, group_goal_index);
        }
      }
      
      let found = false;

      for(const tab of tabs){

        if(tab.url == NEW_TAB_URL || tab.pendingUrl == NEW_TAB_URL){
          if(storage_cache.close && found)
          {
            await RemoveTab(tab);
            continue;
          }

          if(storage_cache.move && !found && tab.index != group_goal_index)
            await MoveTabInGroup(tab, group_goal_index, group.id, window_id);
          
          found = true;
        }
      }

      if(!found && !is_moving && !is_creating_in_group)
      {
        await CreateNewTabInGroup(window_id, group.id, (new_tab) => {
          if(removed_active)
            chrome.tabs.update(new_tab.id, { active: true });
        });
      }
    }
  }
}

async function MoveTab(tab, goal_index, window_id){
  if(is_recheck_move)
  {
    is_recheck_move = false;
    is_moving = false; 
    return;
  }

  //console.log("Move tab");

  is_moving = true;
    
  chrome.tabs.move(tab.id, {index: goal_index, windowId: window_id}, () => {
    if(chrome.runtime.lastError){
      setTimeout(() => MoveTab(tab, goal_index, window_id), 100);
      return;
    }

    is_moving = false;
  });
}

async function MoveTabInGroup(tab, group_goal_index, group_id, window_id){
  if(is_recheck_move)
  {
    is_recheck_move = false;
    is_moving = false; 
    return;
  }
  
  //console.log("Move tab in group");
  
  is_moving = true;

  chrome.tabs.move(tab.id, {index: group_goal_index, windowId: window_id}, () => {
    if(chrome.runtime.lastError){
      setTimeout(() => MoveTabInGroup(tab, group_goal_index, group_id, window_id), 100);
      return;
    }
    chrome.tabs.group({tabIds: tab.id, groupId: group_id});
    ignore_moved++;
    is_moving = false;
  });
}

async function RemoveTab(tab){
  //console.log("Remove tab");

  // When we set is_recheck_remove to true next call to Check should and is called with delay of 100 ms
  if(is_recheck_remove)
    return;

  await chrome.tabs.remove(tab.id, () => {
    if(chrome.runtime.lastError){
      setTimeout(() => RemoveTab(tab), 100);
      return;
    }
  
    ignore_removed++;
  });
}

async function CreateNewTab(window_id, callback)
{
  //console.log("Create tab");

  is_creating = true;
  
  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, (new_tab) => {
    if(chrome.runtime.lastError){
      if(chrome.runtime.lastError.message.startsWith("No window with id"))
      {
        is_creating = false;
        return;
      }
      
      setTimeout(() => CreateNewTab(window_id, callback), 100);
      return;
    }

    is_creating = false;

    callback(new_tab);
  });
}

async function CreateNewTabInGroup(window_id, group_id, callback)
{
  //console.log("Create tab in group");

  is_creating_in_group = true;

  chrome.tabs.create({url: NEW_TAB_URL, active: false, windowId: window_id}, async (new_tab) => {
    if(chrome.runtime.lastError){
      setTimeout(() => CreateNewTabInGroup(window_id, group_id, callback), 100);
      return;
    }

    await chrome.tabs.group({tabIds: new_tab.id, groupId: group_id});
    ignore_moved++;

    is_creating_in_group = false;

    callback(new_tab);
  });
}



// Detect Group change
async function DetectGroupChange(window_id)
{
  //console.log("Detect Group Change");

  for(const tab of (await chrome.tabs.query({windowId: window_id})))
  {
    if(last_check_group_ids.has(tab.id) && tab.groupId != last_check_group_ids.get(tab.id) && !is_moving)
    {
      //console.log("Group Changed from ", last_check_group_ids.get(tab.id), " to ", tab.groupId);
      is_recheck_remove = true;
      setTimeout(() =>  Check(window_id), 100);
    }

    last_check_group_ids.set(tab.id, tab.groupId);
  }

  setTimeout(() => DetectGroupChange(window_id), 1000);
}