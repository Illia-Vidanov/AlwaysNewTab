import { GetStorageChache, AddEvent } from "../scripts/common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const storage_cache = {};
  try {
    Object.assign(storage_cache, await GetStorageChache());
  }
  catch(error){
    console.error("Error while getting storage cache: ", error.message);
  }

  let open = document.getElementById("open");
  let move = document.getElementById("move");
  let close = document.getElementById("close");
  let group = document.getElementById("group");
  let move_dir = document.getElementById("move_dir");
  let enable = document.getElementById("enable");
  
  AddEvent(move, "change", () => {
    storage_cache.move = move.checked;
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
  });
  
  AddEvent(close, "change", () => {
    storage_cache.close = close.checked;
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
  });
  
  AddEvent(group, "change", () => {
    storage_cache.group = group.checked;
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
  });

  AddEvent(open, "change", () => {
    storage_cache.open = open.checked;
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
  });

  AddEvent(move_dir, "change", () => {
    storage_cache.move_dir = move_dir.value;
    //console.log(storage_cache.move_dir);
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
  });
  
  AddEvent(enable, "click", () => {
    storage_cache.enabled = !storage_cache.enabled;
    chrome.runtime.sendMessage({msg: "Check"});
    chrome.storage.sync.set(storage_cache);
    SetPopupState(storage_cache.enabled);
  });

  open.checked = storage_cache.open;
  move.checked = storage_cache.move;
  close.checked = storage_cache.close;
  group.checked = storage_cache.group;
  move_dir.value = storage_cache.move_dir;

  SetPopupState(storage_cache.enabled);
});

async function SetPopupState(state) {
  ChangeObjectClass("top_image_overlay", state);
  ChangeObjectClass("bottom_image_overlay", state);
  ChangeObjectClass("enable_button_overlay", state);

  document.getElementById("enable_lable").innerHTML = state ? "Enabled!" : "Disabled!";
}

async function ChangeObjectClass(class_name, state) {
  for(const obj of document.getElementsByClassName(class_name))
  {
    obj.classList.remove(class_name + "_disabled");
    obj.classList.remove(class_name + "_enabled");

    if(state)
    {
      obj.classList.add(class_name + "_enabled");
      continue;
    }

    obj.classList.add(class_name + "_disabled");
  }
}