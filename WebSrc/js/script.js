(() => {
    if (window.QuickDrawWindows === true) {
        document.body.classList.add("QuickDrawWindows");
    }
    
    if (window.QuickDrawMacOs === true) {
        document.body.classList.add("QuickDrawMacOs");
    }
    
    function AddMessageListener(func) {
        if (window.QuickDrawWindows === true) {
            window.chrome.webview.addEventListener('message',func);
        } else if (window.QuickDrawMacOs === true) {
            window.addEventListener('qd-message',func);
        }
    }
    
    function PostMessage(message) {
        if (window.QuickDrawWindows === true) {
            window.chrome.webview.postMessage(message)
        } else if (window.QuickDrawMacOs === true) {
            window.webkit.messageHandlers.bridge.postMessage(message);
        }
    }
    
    function ParseMessageEvent(e) {
        if (window.QuickDrawWindows === true) {
            return { type: e.data.type, data: e.data.data}
        }
        if (window.QuickDrawMacOs === true) {
            return { type: e.detail.type, data: e.detail.data}
        }
    }
    
    var request = window.indexedDB.open("QuickDraw");

    request.onerror = e => {
        console.error("Database open error: " + e.target.error);
    };

    request.onupgradeneeded = e => {
        var db = e.target.result;

        var objectStore = db.createObjectStore("folders", { keyPath: "Path"});
    };

    request.onsuccess = e => {
        var db = e.target.result;

        db.onerror = e => {
            console.error("Database error: " + e.target.error);
        };

        var timeInputElems = document.querySelectorAll('#footer > div.time-item > input');
        var timeInterval = localStorage.getItem('timeInterval')
        if (timeInterval === null) {
            timeInterval = '60';
            localStorage.setItem('timeInterval', timeInterval);
        }

        timeInputElems.forEach(timeInputElem => {
            timeInputElem.checked = false;

            if (timeInputElem.value === timeInterval)
            {
                timeInputElem.checked = true;
            }

            timeInputElem.addEventListener('click', e => {
                localStorage.setItem('timeInterval', timeInputElem.value);
            });
        })

        var masterCheckboxElem = document.querySelector('#folder-list-container > div.folder-list-header > div.master-checkbox > input');

        var masterCheckboxEnabled = localStorage.getItem('masterEnabled');
        if (masterCheckboxEnabled === null) {
            localStorage.setItem('masterEnabled', false);
        } else {
            masterCheckboxElem.checked = localStorage.getItem('masterEnabled') === 'true';
        }

        masterCheckboxElem.addEventListener('click', e => {
            var checkboxElems = document.querySelectorAll('#folder-list-container > ul.folder-list > li > div > input');

            var enabledTransaction = db.transaction(['folders'], 'readwrite');
            var objectStore = enabledTransaction.objectStore("folders");

            var masterEnabled = e.target.checked;

            checkboxElems.forEach(checkboxElem => {
                objectStore.get(checkboxElem.parentElement.parentElement.getAttribute('data-folder-path')).onsuccess = e => {
                    var folder = e.target.result;
                    folder.enabled = masterEnabled;
                    objectStore.put(folder);
                };
                checkboxElem.checked = masterEnabled;
            });

            localStorage.setItem('masterEnabled', masterEnabled);
        });

        function UpdateFoldersFromDB() {
            var getAllTransaction = db.transaction(["folders"], "readonly");
    
            var objectStore = getAllTransaction.objectStore("folders");
    
            objectStore.getAll().onsuccess = e => {
                var folders = e.target.result;
    
                var foldersElem = document.querySelector("#folder-list-container > ul.folder-list");
                while (foldersElem.lastChild.nodeType === Node.TEXT_NODE || !foldersElem.lastChild.classList.contains("empty")) {
                    foldersElem.removeChild(foldersElem.lastChild);
                }

                var createFolderElem = folderItem => {
                    var clone = template.content.cloneNode(true);

                    var liElem = clone.querySelector('li');
                    liElem.setAttribute("data-folder-path", folderItem.Path);
                    
                    var pathElem = clone.querySelector("div.folder-path");
                    pathElem.innerHTML = folderItem.Path;
    
                    var countElem = clone.querySelector("div.folder-image-count");
                    countElem.innerHTML = folderItem.Count;

                    var refreshFolderElem = clone.querySelector("button.refresh-folder");
                    refreshFolderElem.addEventListener("click", e => {
                        RefreshFolder(folderItem);
                    });

                    var openFolderElem = clone.querySelector("button.open-folder");
                    openFolderElem.addEventListener("click", e => {
                        OpenFolder(folderItem);
                    });

                    var removeFolderElem = clone.querySelector("button.remove-folder");
                    removeFolderElem.addEventListener("click", e => {
                        RemoveFolder(folderItem.Path);
                    });

                    var checkboxElem = clone.querySelector("input[type='checkbox']");
                    checkboxElem.checked = folderItem.enabled;

                    var toggleFolderEvent = e => {
                        if (e.target !== checkboxElem)
                        {
                            checkboxElem.checked = !checkboxElem.checked;
                        }

                        if (!checkboxElem.checked)
                        {
                            localStorage.setItem('masterEnabled', checkboxElem.checked);
                            masterCheckboxElem.checked = checkboxElem.checked;
                        }

                        var enabledTransaction = db.transaction(['folders'], 'readwrite');

                        var objectStore = enabledTransaction.objectStore("folders");

                        var folder = folderItem;
                        folder.enabled = checkboxElem.checked;
                        objectStore.put(folder);
                    }
                    checkboxElem.addEventListener('click', toggleFolderEvent);

                    pathElem.addEventListener('click', toggleFolderEvent);
                    countElem.addEventListener('click', toggleFolderEvent);

                    foldersElem.appendChild(clone);
                }
    
                for (const folderItem of folders)
                {
                    createFolderElem(folderItem);
                }
            }
        }

        function RefreshFolder(folder) {
            PostMessage({
                type: "refreshFolder",
                path: folder.Path
            });
        }

        function OpenFolder(folder) {          
            PostMessage({
                type: "openFolder",
                path: folder.Path
            });
        }

        function RemoveFolder(path) {
            var removeTransaction = db.transaction(["folders"], "readwrite");

            var objectStore = removeTransaction.objectStore("folders");
                objectStore.count(path).onsuccess = e => {
                    if (e.target.result > 0)
                    {
                        objectStore.delete(path);
                    }
                };

            removeTransaction.onerror = e => {
                console.error("Transaction Error: " + e.target.error);
            }

            removeTransaction.oncomplete = e => {
                UpdateFoldersFromDB();
            };
        }

        UpdateFoldersFromDB();

        var template = document.querySelector("#folder-row");

        var refreshFoldersElem = document.getElementById("refresh-folders");
        refreshFoldersElem.addEventListener('click', event => {
            var folderElems = document.querySelectorAll('#folder-list-container > ul.folder-list > li:not(.empty)');
            var folders = [];

            folderElems.forEach(folderElem => {
                folders.push(folderElem.getAttribute('data-folder-path'));
            });

            PostMessage({
                type: "refreshFolders",
                paths: folders
            })
        })
    
        var addFoldersElem = document.getElementById("add-folders");
        addFoldersElem.addEventListener('click', event => {
            PostMessage({
                type: "addFolders"
            });
        });

        var startElem = document.getElementById("start");
        startElem.addEventListener('click', e => {
            var folderElems = document.querySelectorAll('#folder-list-container > ul.folder-list > li:not(.empty)');
            var folders = [];

            folderElems.forEach(folderElem => {
                var checkboxElem = folderElem.querySelector("input[type='checkbox']");
                
                if (checkboxElem.checked) {
                    folders.push(folderElem.getAttribute('data-folder-path'));
                }
            });

            if (folders.length === 0)
            {
                // no folders selected, do something
            }

            PostMessage({
                type: "getImages",
                paths: folders,
                interval: parseInt(localStorage.getItem('timeInterval'))
            });
        });
    
        AddMessageListener( event => {
            var message = ParseMessageEvent(event);
            
            switch(message.type) {
                case "UpdateFolders":
                    var updateTransaction = db.transaction(["folders"], "readwrite");

                    var objectStore = updateTransaction.objectStore("folders");
                    message.data.forEach(folder => {
                        objectStore.count(folder.Path).onsuccess = e => {
                            if (e.target.result > 0)
                            {
                                var test = `#folder-list-container > ul.folder-list > li[data-folder-path="${ CSS.escape(folder.Path) }"]`;
                                var folderElem = document.querySelector(`#folder-list-container > ul.folder-list > li[data-folder-path="${ CSS.escape(folder.Path) }"]`);

                                if (folderElem !== null) {
                                    var checkboxElem = folderElem.querySelector("input[type='checkbox']");
                                    folder.enabled = checkboxElem.checked;
                                }

                                objectStore.put(folder);
                            } else {
                                folder.enabled = false;
                                objectStore.add(folder);
                            }
                        };
                    });

                    updateTransaction.onerror = e => {
                        console.error("Transaction Error: " + e.target.error);
                    }

                    updateTransaction.oncomplete = e => {
                        UpdateFoldersFromDB();
                    };
                    break;
                default:
                    break;
            }
        });
    };
})();
