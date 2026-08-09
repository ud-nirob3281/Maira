import { Type } from "@google/genai";

export const SHARED_TOOL_DECLARATIONS = [
                {
                  name: "delegateToSabit",
                  description: "Delegates a browser-based or background automation task (like playing background music, loading a video, searching the web, or scraping a page) to Sabit, our independent second assistant worker. This offloads the work, keeping you free to chat. Only delegate if you cannot run it directly, or if it is a long-running/concurrency-intensive task.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      task: {
                        type: Type.STRING,
                        description: "The natural language instruction of the task to delegate, e.g. 'Play Believer on YouTube', 'Scrape pricing from Amazon', 'Search Google for news'."
                      }
                    },
                    required: ["task"]
                  }
                },
                {
                  name: "browserOpen",
                  description: "Opens a designated website URL or interface tab inside Myraa's web agent console.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The destination website address or path, e.g. youtube.com, google.com, instagram.com, wikipedia.org."
                      }
                    },
                    required: ["url"]
                  }
                },
                {
                  name: "browserSearch",
                  description: "Enters a query search term inside the active website's search box (Google Search or YouTube Search).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "The text query term to search for."
                      }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "browserClick",
                  description: "Traces computer cursor and clicks on a target button, link, or video cell ID inside the active webpage viewport.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: {
                        type: Type.STRING,
                        description: "The selector target ID, e.g. 'video-mWRsgZjdfQI' for a video, 'search-result-0' for Google link index, or 'play-button', 'pause-button'."
                      },
                      description: {
                        type: Type.STRING,
                        description: "A short, friendly label description of the item being clicked, e.g. 'Imagine Dragons - Believer video element'."
                      }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "browserMediaControl",
                  description: "Controls ongoing video/audio stream media properties on YouTube, like play, pause, volume, mute, skip, and fullscreen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The media controller command operation.",
                        enum: ["play", "pause", "volume", "fullscreen", "exit_fullscreen", "mute", "unmute", "skip"]
                      },
                      value: {
                        type: Type.INTEGER,
                        description: "The value parameter; only relevant for set volume level, e.g. 50 for fifty percent."
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "browserScroll",
                  description: "Scrolls the currently active webpage vertically up or down.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: {
                        type: Type.STRING,
                        description: "The scroll vector movement.",
                        enum: ["up", "down"]
                      },
                      amount: {
                        type: Type.INTEGER,
                        description: "The distance height parameter in pixels (defaults to 300)."
                      }
                    }
                  }
                },
                {
                  name: "browserType",
                  description: "Enters typed letters/commands inside the active input container.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "The exact letters to type in."
                      }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "browserGoBack",
                  description: "Navigates back to the previous webpage inside the current tab memory history.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "browserTabAction",
                  description: "Performs standard browser-tab actions: open new tab, close a tab, or switch index values.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "Tab action instruction.",
                        enum: ["new", "close", "switch"]
                      },
                      tabId: {
                        type: Type.STRING,
                        description: "The tab identifier string if closing or switching."
                      },
                      url: {
                        type: Type.STRING,
                        description: "The initial starting URL if creating a new tab."
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Myraa's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
                        description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
                      }
                    },
                    required: ["color"]
                  }
                },
                {
                  name: "saveCustomMemory",
                  description: "Allows Myraa to immediately save a piece of critical user information to her persistent memory core.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category.",
                        enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                      },
                      text: {
                        type: Type.STRING,
                        description: "Precise third-person statement."
                      }
                    },
                    required: ["category", "text"]
                  }
                },

                // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
                {
                  name: "openApplication",
                  description: "Open a desktop application (e.g. Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell).",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Application name, e.g. 'notepad', 'chrome', 'vscode'." } }, required: ["name"] }
                },
                {
                  name: "closeApplication",
                  description: "Close a running desktop application by name.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Application name." }, force: { type: Type.BOOLEAN, description: "Force close (default false)." } }, required: ["name"] }
                },
                {
                  name: "openWebsite",
                  description: "Open a named website or URL in the user's default system browser. Supports shortcuts: youtube, gmail, google, github, chatgpt, etc.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Site name shortcut (e.g. 'youtube', 'gmail')." }, url: { type: Type.STRING, description: "Full URL if no shortcut." } } }
                },
                {
                  name: "searchWeb",
                  description: "Search a website engine (google, youtube, github, duckduckgo, bing) and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." }, engine: { type: Type.STRING, description: "Engine name (default 'google')." } }, required: ["query"] }
                },
                {
                  name: "searchYouTube",
                  description: "Search YouTube and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGoogle",
                  description: "Search Google and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGitHub",
                  description: "Search GitHub repositories and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "createFile",
                  description: "Create a new text file with optional content. Scoped to safe folders (Desktop, Documents, Downloads, etc.).",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "File content (default empty)." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists (default false)." } }, required: ["path"] }
                },
                {
                  name: "createFolder",
                  description: "Create a new folder.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Folder path." } }, required: ["path"] }
                },
                {
                  name: "copyFileOrFolder",
                  description: "Copy a file or a folder with all its contents to a new destination.",
                  parameters: { type: Type.OBJECT, properties: { source: { type: Type.STRING, description: "Source file or folder path." }, destination: { type: Type.STRING, description: "Destination path." } }, required: ["source", "destination"] }
                },
                {
                  name: "readFile",
                  description: "Read the contents of a text file.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, max_chars: { type: Type.INTEGER, description: "Max chars to return (default 8000)." } }, required: ["path"] }
                },
                {
                  name: "renameFile",
                  description: "Rename a file.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Current file path." }, new_name: { type: Type.STRING, description: "New file name." } }, required: ["path", "new_name"] }
                },
                {
                  name: "deleteFile",
                  description: "Delete a file. Sends to Recycle Bin by default (safe). Use permanent=true for hard delete.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, permanent: { type: Type.BOOLEAN, description: "Permanently delete (default false)." } }, required: ["path"] }
                },
                {
                  name: "moveFile",
                  description: "Move a file to a new location.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Source file path." }, destination: { type: Type.STRING, description: "Destination path or folder." } }, required: ["path", "destination"] }
                },
                {
                  name: "openFolder",
                  description: "Open a folder in File Explorer. Supports aliases: desktop, documents, downloads, pictures, music, videos, home.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Folder name or alias." }, path: { type: Type.STRING, description: "Full path if no alias." } } }
                },
                {
                  name: "listFiles",
                  description: "List files in a folder.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Folder name or alias." }, path: { type: Type.STRING, description: "Full path." }, pattern: { type: Type.STRING, description: "Glob pattern (default '*')." } } }
                },
                {
                  name: "searchFiles",
                  description: "Search for files by name glob or extension under a folder.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Filename glob (e.g. '*.py')." }, extension: { type: Type.STRING, description: "File extension (e.g. 'py')." }, folder: { type: Type.STRING, description: "Folder to search (default home)." }, limit: { type: Type.INTEGER, description: "Max results (default 100)." } } }
                },
                {
                  name: "volumeUp",
                  description: "Increase system volume.",
                  parameters: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "volumeDown",
                  description: "Decrease system volume.",
                  parameters: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "setVolume",
                  description: "Set system volume to a specific percentage.",
                  parameters: { type: Type.OBJECT, properties: { percent: { type: Type.NUMBER, description: "Volume percentage 0-100." } }, required: ["percent"] }
                },
                {
                  name: "muteToggle",
                  description: "Toggle mute/unmute on the system volume.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "requestPowerAction",
                  description: "FIRST STEP for dangerous power actions. Generates a confirmation token. Tell the user verbally, then call executePowerAction with the token if they confirm. Actions: shutdown, restart, sleep, lock.",
                  parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: "Power action: shutdown, restart, sleep, lock." } }, required: ["action"] }
                },
                {
                  name: "executePowerAction",
                  description: "SECOND STEP: execute a previously-confirmed power action. Requires a valid execute_token from requestPowerAction. Single-use, expires in 60 seconds.",
                  parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: "The confirmed power action." }, execute_token: { type: Type.STRING, description: "Confirmation token from requestPowerAction." } }, required: ["action", "execute_token"] }
                },
                {
                  name: "minimizeWindow",
                  description: "Minimize the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match (optional, defaults to active window)." } } }
                },
                {
                  name: "maximizeWindow",
                  description: "Maximize the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "closeWindow",
                  description: "Close the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "switchApplication",
                  description: "Switch to a named application window, or cycle Alt+Tab if no title given.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to switch to." } } }
                },
                {
                  name: "copySelected",
                  description: "Copy selected text: sends Ctrl+C and reads the clipboard.",
                  parameters: { type: Type.OBJECT, properties: { wait: { type: Type.NUMBER, description: "Seconds to wait after Ctrl+C (default 0.35)." } } }
                },
                {
                  name: "pasteClipboard",
                  description: "Paste text into the active input. Writes text to clipboard then sends Ctrl+V.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "Text to paste. If omitted, pastes current clipboard." } } }
                },
                {
                  name: "getClipboard",
                  description: "Read the current clipboard text content.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max chars (default 1000)." } } }
                },
                {
                  name: "clearClipboard",
                  description: "Empty the clipboard.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "takeScreenshot",
                  description: "Capture the full screen. Optionally include base64 image data.",
                  parameters: { type: Type.OBJECT, properties: { include_image: { type: Type.BOOLEAN, description: "Include base64 JPEG image (default false)." }, max_dim: { type: Type.INTEGER, description: "Max image dimension (default 1280)." } } }
                },
                {
                  name: "saveScreenshot",
                  description: "Save a screenshot to Pictures/MyraaScreenshots.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Optional filename prefix." } } }
                },
                {
                  name: "analyzeScreenshot",
                  description: "Take a screenshot and run OCR to extract visible text from the screen.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "readScreen",
                  description: "OCR the active window and return its title plus visible text.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "desktopBrowserSnapshot",
                  description: "Capture an accessibility (ARIA) snapshot of the current browser page. Returns a tree of interactive elements, each tagged with a ref like [ref=e1], [ref=e2]. ALWAYS call this BEFORE clicking or typing to see the actual page structure — never guess selectors. The refs returned (e.g. 'e3') are used with desktopBrowserClick/desktopBrowserType for precise, human-level targeting.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserOpen",
                  description: "Open a URL in the desktop Playwright automation browser (real Chromium, separate from holographic UI). Persistent profile — logins/cookies survive.",
                  parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "URL to open." } }, required: ["url"] }
                },
                {
                  name: "desktopBrowserSearch",
                  description: "Navigate directly to a search engine results page in the desktop automation browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." }, engine: { type: Type.STRING, description: "Engine: google, youtube, github, duckduckgo, bing." } }, required: ["query"] }
                },
                {
                  name: "desktopBrowserClick",
                  description: "Click an element in the desktop automation browser. PREFERRED: use 'ref' from a prior desktopBrowserSnapshot (e.g. ref='e3') for precise targeting. Fallback: selector (CSS), text, or role+name. If the click times out, call desktopBrowserSnapshot again to refresh refs.",
                  parameters: { type: Type.OBJECT, properties: { ref: { type: Type.STRING, description: "Element ref from a desktopBrowserSnapshot, e.g. 'e3'. MOST RELIABLE — always prefer this." }, selector: { type: Type.STRING, description: "CSS selector (fallback only)." }, text: { type: Type.STRING, description: "Visible text to click (fallback)." }, role: { type: Type.STRING, description: "ARIA role e.g. 'button', 'link' (fallback)." }, name: { type: Type.STRING, description: "Accessible name for the role (fallback)." } } }
                },
                {
                  name: "desktopBrowserType",
                  description: "Type text into a field in the desktop automation browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot to target the exact input field. Fallback: selector. Clears the field by default before typing.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "Text to type." }, ref: { type: Type.STRING, description: "Element ref from a snapshot, e.g. 'e2'." }, selector: { type: Type.STRING, description: "Optional CSS selector for a specific input (fallback)." }, clear: { type: Type.BOOLEAN, description: "Clear before typing (default true)." } }, required: ["text"] }
                },
                {
                  name: "desktopBrowserFillForm",
                  description: "Fill multiple form fields and optionally submit in the desktop automation browser.",
                  parameters: { type: Type.OBJECT, properties: { fields: { type: Type.OBJECT, description: "Object of selector -> value pairs." }, submit: { type: Type.STRING, description: "Optional submit button selector." } }, required: ["fields"] }
                },
                {
                  name: "desktopBrowserOpenTab",
                  description: "Open a new tab in the desktop automation browser.",
                  parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "URL for the new tab." } } }
                },
                {
                  name: "desktopBrowserCloseTab",
                  description: "Close the active tab in the desktop automation browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserGoBack",
                  description: "Navigate back in the desktop automation browser history.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserGoForward",
                  description: "Navigate forward in the desktop automation browser history.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserGoForward",
                  description: "Navigate forward in the browser history.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserRefresh",
                  description: "Reload/refresh the current page in the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserRefresh",
                  description: "Reload/refresh the current page in the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserPageSearch",
                  description: "Find occurrences of a text string on the active page (like Ctrl+F). Highlights or scrolls to matches.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "The word or phrase to search for." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "browserPageSearch",
                  description: "Find occurrences of a text string on the active page (like Ctrl+F). Highlights or scrolls to matches.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "The word or phrase to search for." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "desktopBrowserDoubleClick",
                  description: "Double click an element in the browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "browserDoubleClick",
                  description: "Double click an element in the browser. PREFERRED: use 'ref' from a snapshot.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "desktopBrowserRightClick",
                  description: "Right click an element in the browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "browserRightClick",
                  description: "Right click an element in the browser. PREFERRED: use 'ref' from a snapshot.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "desktopBrowserDragAndDrop",
                  description: "Drag a source element and drop it on a target element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      source_ref: { type: Type.STRING, description: "Source element ref from snapshot." },
                      target_ref: { type: Type.STRING, description: "Target element ref from snapshot." },
                      source_selector: { type: Type.STRING, description: "Optional source CSS selector fallback." },
                      target_selector: { type: Type.STRING, description: "Optional target CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "browserDragAndDrop",
                  description: "Drag a source element and drop it on a target element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      source_ref: { type: Type.STRING, description: "Source element ref from snapshot." },
                      target_ref: { type: Type.STRING, description: "Target element ref from snapshot." },
                      source_selector: { type: Type.STRING, description: "Optional source CSS selector fallback." },
                      target_selector: { type: Type.STRING, description: "Optional target CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "desktopBrowserSelectText",
                  description: "Select/highlight a range of text in an element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "browserSelectText",
                  description: "Select/highlight a range of text in an element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." }
                    }
                  }
                },
                {
                  name: "desktopBrowserZoom",
                  description: "Zoom page in, out, or reset in the browser (e.g. 'in', 'out', 'reset').",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, description: "Action: in, out, reset." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "browserZoom",
                  description: "Zoom page in, out, or reset in the browser (e.g. 'in', 'out', 'reset').",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, description: "Action: in, out, reset." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "desktopBrowserDuplicateTab",
                  description: "Duplicate the active tab in the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserDuplicateTab",
                  description: "Duplicate the active tab in the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserPinTab",
                  description: "Pin or unpin the active tab in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      pin: { type: Type.BOOLEAN, description: "True to pin, false to unpin." }
                    },
                    required: ["pin"]
                  }
                },
                {
                  name: "browserPinTab",
                  description: "Pin or unpin the active tab in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      pin: { type: Type.BOOLEAN, description: "True to pin, false to unpin." }
                    },
                    required: ["pin"]
                  }
                },
                {
                  name: "desktopBrowserBookmark",
                  description: "Add a bookmark for the current page in the browser with a custom title.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Optional custom title for the bookmark." }
                    }
                  }
                },
                {
                  name: "browserBookmark",
                  description: "Add a bookmark for the current page in the browser with a custom title.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Optional custom title for the bookmark." }
                    }
                  }
                },
                {
                  name: "desktopBrowserListDownloads",
                  description: "List files that have been downloaded during the current browser session.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserListDownloads",
                  description: "List files that have been downloaded during the current browser session.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserUploadFile",
                  description: "Upload a local file to a file-input element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." },
                      file_path: { type: Type.STRING, description: "Absolute or relative path of file on local PC." }
                    },
                    required: ["file_path"]
                  }
                },
                {
                  name: "browserUploadFile",
                  description: "Upload a local file to a file-input element in the browser.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ref: { type: Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
                      selector: { type: Type.STRING, description: "Optional CSS selector fallback." },
                      file_path: { type: Type.STRING, description: "Absolute or relative path of file on local PC." }
                    },
                    required: ["file_path"]
                  }
                },
                {
                  name: "desktopBrowserPrintToPDF",
                  description: "Print the current page to a PDF file on disk.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      output_path: { type: Type.STRING, description: "Where to save the PDF file, e.g. Downloads/mypage.pdf." }
                    },
                    required: ["output_path"]
                  }
                },
                {
                  name: "browserPrintToPDF",
                  description: "Print the current page to a PDF file on disk.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      output_path: { type: Type.STRING, description: "Where to save the PDF file, e.g. Downloads/mypage.pdf." }
                    },
                    required: ["output_path"]
                  }
                },
                {
                  name: "desktopBrowserDismissPopups",
                  description: "Dismiss common cookie consent dialogs, newsletter popups, and simple alert prompts.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserDismissPopups",
                  description: "Dismiss common cookie consent dialogs, newsletter popups, and simple alert prompts.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserInfiniteScroll",
                  description: "Trigger loading of infinite-scrolling pages (like social feeds) by scrolling down iteratively.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_scrolls: { type: Type.INTEGER, description: "Max scroll iterations (default 5)." },
                      delay_seconds: { type: Type.NUMBER, description: "Seconds to wait between scrolls (default 1.0)." }
                    }
                  }
                },
                {
                  name: "browserInfiniteScroll",
                  description: "Trigger loading of infinite-scrolling pages (like social feeds) by scrolling down iteratively.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_scrolls: { type: Type.INTEGER, description: "Max scroll iterations (default 5)." },
                      delay_seconds: { type: Type.NUMBER, description: "Seconds to wait between scrolls (default 1.0)." }
                    }
                  }
                },
                {
                  name: "desktopBrowserWaitForElement",
                  description: "Wait for a specific element to be visible/present in the browser viewport.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: { type: Type.STRING, description: "CSS selector of the element." },
                      timeout_seconds: { type: Type.INTEGER, description: "Max seconds to wait (default 10)." }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "browserWaitForElement",
                  description: "Wait for a specific element to be visible/present in the browser viewport.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      selector: { type: Type.STRING, description: "CSS selector of the element." },
                      timeout_seconds: { type: Type.INTEGER, description: "Max seconds to wait (default 10)." }
                    },
                    required: ["selector"]
                  }
                },
                {
                  name: "desktopBrowserScroll",
                  description: "Scroll the desktop automation browser page.",
                  parameters: { type: Type.OBJECT, properties: { direction: { type: Type.STRING, description: "Scroll direction: up or down." }, amount: { type: Type.INTEGER, description: "Pixels to scroll (default 500)." } } }
                },
                {
                  name: "desktopBrowserScreenshot",
                  description: "Take a screenshot of the current browser page (compressed JPEG). Use this to visually see what's on the page when the ARIA snapshot is unclear or to verify a page loaded correctly. The image is returned as base64 — you can see it.",
                  parameters: { type: Type.OBJECT, properties: { fullPage: { type: Type.BOOLEAN, description: "Capture the full scrollable page (default false)." } } }
                },
                {
                  name: "desktopBrowserGetText",
                  description: "Extract readable text content from the current browser page (or a specific element). Use this to read article content, search results, product details, email subjects — any text on the page.",
                  parameters: { type: Type.OBJECT, properties: { selector: { type: Type.STRING, description: "Optional CSS selector to read a specific element (default: entire page body)." } } }
                },
                {
                  name: "desktopBrowserListTabs",
                  description: "List all open browser tabs with their URLs and titles.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserSwitchTab",
                  description: "Switch the active browser tab by index (from desktopBrowserListTabs).",
                  parameters: { type: Type.OBJECT, properties: { index: { type: Type.INTEGER, description: "Tab index (0-based)." } }, required: ["index"] }
                },
                {
                  name: "desktopBrowserPressKey",
                  description: "Press a single keyboard key in the browser (e.g. 'Enter', 'Escape', 'Tab'). Useful to submit a search form after typing.",
                  parameters: { type: Type.OBJECT, properties: { key: { type: Type.STRING, description: "Key name e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown'." } }, required: ["key"] }
                },
                {
                  name: "desktopBrowserMediaControl",
                  description: "Control media playback in the browser (YouTube etc.). Actions: play, pause, volumeup, volumedown, mute, unmute, skip, fullscreen.",
                  parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: "Action: play, pause, volumeup, volumedown, mute, unmute, skip, fullscreen." } }, required: ["action"] }
                },
                {
                  name: "browserSessionStatus",
                  description: "Check the status, current page URL, title, and open tab count of the active browser automation session.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserSessionStatus",
                  description: "Check the status, current page URL, title, and open tab count of the active browser automation session.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserSessionClose",
                  description: "Manually close the active browser session and release resources. Call ONLY when the user explicitly requests to close or exit the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopBrowserSessionClose",
                  description: "Manually close the active browser session and release resources. Call ONLY when the user explicitly requests to close or exit the browser.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "browserSessionRestore",
                  description: "Ensure the browser session is open and optionally navigate to a specific URL, restoring its persistent state.",
                  parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "Optional URL to open/restore to." } } }
                },
                {
                  name: "desktopBrowserSessionRestore",
                  description: "Ensure the browser session is open and optionally navigate to a specific URL, restoring its persistent state.",
                  parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "Optional URL to open/restore to." } } }
                },
                {
                  name: "ocrHealthCheck",
                  description: "Runs a comprehensive health check of the local Tesseract OCR installation, detecting available language data files (English, Bangla, Hindi).",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "desktopOcrHealthCheck",
                  description: "Runs a comprehensive health check of the local Tesseract OCR installation, detecting available language data files (English, Bangla, Hindi).",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "createPythonFile",
                  description: "Create a Python (.py) file with content.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "Python code content." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "writeCodeFile",
                  description: "Create a code file in any language with appropriate extension.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "Code content." }, language: { type: Type.STRING, description: "Language name (e.g. 'python', 'javascript', 'html')." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "createProjectFolder",
                  description: "Create a project folder structure with optional subfolders and starter files.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Project root folder path." }, subfolders: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of subfolder names." }, scaffold_standard: { type: Type.BOOLEAN, description: "Create src, tests, docs subfolders." }, files: { type: Type.OBJECT, description: "Object of relative-path -> content for starter files." } }, required: ["path"] }
                },
                {
                  name: "runPythonScript",
                  description: "Execute a Python script and capture stdout, stderr, and exit code. Has a configurable timeout.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Script path." }, args: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Script arguments." }, timeout: { type: Type.INTEGER, description: "Timeout in seconds (default 30)." } }, required: ["path"] }
                },
                {
                  name: "systemInfo",
                  description: "Get system resource usage: CPU %, RAM %, disk usage, uptime, OS info.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "gpuInfo",
                  description: "Get NVIDIA GPU stats: utilization %, VRAM usage, temperature. Graceful fallback if no NVIDIA GPU.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "temperatureInfo",
                  description: "Get available temperature readings (CPU, GPU, etc.). Best-effort on Windows.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "clearRecycleBin",
                  description: "Empty the operating system recycle bin / trash folder. Call when the user explicitly requests to clear or empty the Recycle Bin.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                // --- V2: Brightness control ---
                {
                  name: "brightnessUp",
                  description: "Increase screen brightness by a step (default 10%). Use when user says 'increase brightness' or 'make screen brighter'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER, description: "Percentage to increase (default 10)." }
                    }
                  }
                },
                {
                  name: "brightnessDown",
                  description: "Decrease screen brightness by a step (default 10%). Use when user says 'decrease brightness' or 'dim screen'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER, description: "Percentage to decrease (default 10)." }
                    }
                  }
                },
                {
                  name: "setBrightness",
                  description: "Set screen brightness to an exact level. Use when user says 'set brightness to 50%' or 'brightness 80'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      percent: { type: Type.NUMBER, description: "Target brightness 0-100." }
                    },
                    required: ["percent"]
                  }
                },
                // --- V2: Windows auto-start management ---
                {
                  name: "enableAutoStart",
                  description: "Enable MYRAA to launch automatically when Windows starts. Creates a silent startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "disableAutoStart",
                  description: "Disable MYRAA auto-start on Windows login. Removes the startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "getAutoStartStatus",
                  description: "Check whether MYRAA is currently configured to auto-start on Windows login.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                // --- V2: Mouse & keyboard input control ---
                {
                  name: "moveCursor",
                  description: "Move the mouse pointer to absolute screen coordinates (x, y pixels). Use when user says 'move mouse' or gives a screen position.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.INTEGER, description: "Target X pixel coordinate." },
                      y: { type: Type.INTEGER, description: "Target Y pixel coordinate." }
                    },
                    required: ["x", "y"]
                  }
                },
                {
                  name: "mouseClick",
                  description: "Click the mouse: left, right, or middle; single or double. Use 'right' for context menus, double-clicks for opening items.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      button: { type: Type.STRING, description: "left, right, or middle (default left)." },
                      clicks: { type: Type.INTEGER, description: "Number of clicks (default 1; 2 = double-click)." },
                      x: { type: Type.INTEGER, description: "Optional X coordinate to click at." },
                      y: { type: Type.INTEGER, description: "Optional Y coordinate to click at." }
                    }
                  }
                },
                {
                  name: "typeText",
                  description: "Type a string of text into the currently focused input field or element. Use after clicking an input or when an element is already focused.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "The text to type." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "pressKey",
                  description: "Press a single keyboard key, e.g. 'enter', 'escape', 'tab', 'space', 'backspace', 'delete', 'up', 'down'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING, description: "Key name, e.g. 'enter', 'escape', 'tab'." }
                    },
                    required: ["key"]
                  }
                },
                {
                  name: "sendHotkey",
                  description: "Press a keyboard shortcut combo, e.g. 'ctrl+c', 'ctrl+v', 'alt+f4', 'win+d', 'ctrl+shift+esc'. Use for any multi-key shortcut.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      keys: { type: Type.STRING, description: "Hotkey combo like 'ctrl+c' or 'alt+tab'." }
                    },
                    required: ["keys"]
                  }
                },
                {
                  name: "scrollMouse",
                  description: "Scroll the mouse wheel up or down by a number of clicks.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: { type: Type.STRING, description: "up or down (default down)." },
                      amount: { type: Type.INTEGER, description: "Number of scroll clicks (default 5)." }
                    }
                  }
                },
                // --- V2: Advanced file search & editing ---
                {
                  name: "searchPcWide",
                  description: "Search the ENTIRE PC across all drives (C:, D:, E:, etc.) for a file or folder using fuzzy matching. Ignores spaces, dots, dashes, underscores. Use when user says 'find' or 'open' something without a full path, e.g. 'open mydata folder', 'find config.json'. Auto-opens the best match.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "File/folder name or fuzzy path like 'F:/my data/3.userdata' or just 'mydata'." },
                      limit: { type: Type.INTEGER, description: "Max results (default 50)." }
                    },
                    required: ["query"]
                  }
                },
                // --- Semantic / intent-based file search ---
                {
                  name: "semanticSearchFiles",
                  description: "Find files or folders from a NATURAL-LANGUAGE description (intent + type hints + recency). Use this when the user describes WHAT they want rather than an exact name. Examples: 'React project খুলে দাও', 'yesterday PDF edit করেছিলাম', 'Web development folder-er React file'. Auto-opens the best match.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "Natural-language description of the file/folder to find." },
                      pc_wide: { type: Type.BOOLEAN, description: "Search all drives (default false — safe roots only)." },
                      open: { type: Type.BOOLEAN, description: "Open the best match (default true)." },
                      limit: { type: Type.INTEGER, description: "Max results (default 8)." },
                      max_depth: { type: Type.INTEGER, description: "Walk depth (default 6)." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "editFile",
                  description: "Edit a file in-place by finding and replacing text. Supports exact string or regex replacement. Saves changes immediately. Use for commands like 'change the port to 3005 in config.json'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING, description: "File path to edit." },
                      find: { type: Type.STRING, description: "Exact text to find (use this OR find_regex)." },
                      replace: { type: Type.STRING, description: "Text to replace with (default empty)." },
                      find_regex: { type: Type.STRING, description: "Regex pattern to find (use this OR find)." },
                      allow_anywhere: { type: Type.BOOLEAN, description: "Allow editing files outside safe folders (default false)." }
                    },
                    required: ["path"]
                  }
                },
                {
                  name: "desktopBrowserNavigate",
                  description: "Navigate the desktop automation browser to a new URL (alias of desktopBrowserOpen).",
                  parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "URL to navigate to." } }, required: ["url"] }
                },
                // --- V3: Smart visual clicking ---
                {
                  name: "screenResolution",
                  description: "Get the screen size in physical pixels. Call this before computing any absolute coordinates.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "clickOnText",
                  description: "Find text or a label VISIBLE on the screen via OCR and click its exact center. USE THIS (not mouseClick with guessed coordinates) when the user says 'click on <something visible like a button, icon label, or menu item>'. Fuzzy-matches (ignores case/punctuation).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "The visible text/label to find and click, e.g. 'Settings', 'Chrome', 'Save'." },
                      button: { type: Type.STRING, description: "left, right, or middle (default left)." },
                      double: { type: Type.BOOLEAN, description: "Double-click (default false)." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "findOnScreen",
                  description: "Find where a visible text/label is on screen (returns coordinates) WITHOUT clicking. Use to locate something before deciding the next step.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING, description: "The text to locate." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "sabitTaskComplete",
                  description: "Call this tool ONLY when you have fully executed the delegated background task AND verified its completion (e.g. video is playing, or email is sent, or page is scraped). This will transition your task status to completed.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "sabitTaskFailed",
                  description: "Call this tool ONLY when you have confirmed clear, undeniable evidence that the delegated task cannot be completed due to unrecoverable blockers (e.g. permanent CAPTCHA, invalid URL, or unreachable Desktop Agent). Do NOT call this tool if the page is still loading, DOM is updating, login is finishing, or an element is temporarily hidden — take a fresh snapshot ('desktopBrowserSnapshot') or wait first.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      reason: { type: Type.STRING, description: "The clear, user-facing reason why the task failed." }
                    },
                    required: ["reason"]
                  }
                },
                {
                  name: "sabitWaitingForUser",
                  description: "Call this tool if task execution requires human intervention on screen (e.g. scanning a QR code, solving a CAPTCHA, entering a 2FA/OTP code, or logging into an account). The task remains active in WAITING_FOR_USER state until the user completes the action.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      message: { type: Type.STRING, description: "Clear instructions for the user describing what action is needed on screen." }
                    },
                    required: ["message"]
                  }
                }

];
