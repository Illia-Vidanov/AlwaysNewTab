document.addEventListener('DOMContentLoaded',
function()
{
	var enabled = document.getElementById("enabled");
	var move = document.getElementById("move");
	var close = document.getElementById("close");
	
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
	
	chrome.storage.sync.get("enabled",
	function(data)
	{
		enabled.checked = data.enabled;
	});
	
	chrome.storage.sync.get("move",
	function(data)
	{
		move.checked = data.move;
	});
	chrome.storage.sync.get("close",
	function(data)
	{
		close.checked = data.close;
	});
});