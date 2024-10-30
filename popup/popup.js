document.addEventListener('DOMContentLoaded',
function()
{
  var enabled = document.getElementById("enabled");
  var move = document.getElementById("move");
  var close = document.getElementById("close");
  var group = document.getElementById("group");
  
  enabled.addEventListener("change",
  function()
  {
    chrome.storage.sync.set({ enabled: this.checked });
    chrome.runtime.sendMessage({ msg: "Check" });
  });
  
  move.addEventListener("change",
  function()
  {
    chrome.storage.sync.set({ move: this.checked });
    chrome.runtime.sendMessage({ msg: "Check" });
  });
  
  close.addEventListener("change",
  function()
  {
    chrome.storage.sync.set({ close: this.checked });
    chrome.runtime.sendMessage({ msg: "Check" });
  });
  
  group.addEventListener("change",
  function()
  {
    chrome.storage.sync.set({ group: this.checked });
    chrome.runtime.sendMessage({ msg: "Check" });
  });
  
  
  chrome.storage.sync.get({"enabled": true}, function(data){
    enabled.checked = data.enabled;
  });
  
  chrome.storage.sync.get({"move": true}, function(data){
    move.checked = data.move;
  });
  
  chrome.storage.sync.get({"close": true}, function(data){
    close.checked = data.close;
  });
  
  chrome.storage.sync.get({"group": true}, function(data){
    group.checked = data.group;
  });
  
  
  chrome.runtime.sendMessage({ msg: "Check" });
});