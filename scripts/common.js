async function GetStorageChache()
{
  return new Promise(async (resolve, reject) => {
    let storage_cache = {};
    try {
      storage_cache = await chrome.storage.sync.get({
        // Defaults do not forget to change them in popup.html too!!!
        "enabled": true,
        "open": true,
        "move": true,
        "close": true,
        "group": false
      });

      //console.log("utils.js\n",
      //  "Enabled: ", storage_cache.enabled, '\n',
      //  "Group: ",   storage_cache.group,   '\n',
      //  "Move: ",    storage_cache.move,    '\n',
      //  "Close: ",   storage_cache.close,   '\n',
      //  "Open: ",    storage_cache.open);

      resolve(storage_cache);
    } catch (error) {
      reject(error);
    }
  });
}

function AddEvent(obj, event, callback){
  if (obj.attachEvent)
   return obj.attachEvent('on'+ event, callback);
  else
   return obj.addEventListener(event, callback, false);
}

function SwapArrayElements(arr, left_index, right_index){
  let temp_left = arr[left_index];
  arr[left_index] = arr[right_index];
  arr[right_index] = temp_left;
}

function Swap(left, right){
  let temp_left = left;
  left = right;
  right = temp_left;
}

const enum_value = (name) => Object.freeze({toString: () => name});

export { GetStorageChache, AddEvent, Swap, SwapArrayElements, enum_value };