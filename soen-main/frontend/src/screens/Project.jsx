import { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../context/user.context";
import { useLocation } from "react-router-dom";
import axios from "../config/axios";
import { initializeSocket, receiveMessage, sendMessage } from "../config/socket";
import Markdown from "markdown-to-jsx";
import hljs from "highlight.js";
import { getWebContainer } from "../config/webContainer";

function SyntaxHighlightedCode(props) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && props.className?.includes("lang-")) {
      hljs.highlightElement(ref.current);
      ref.current.removeAttribute("data-highlighted");
    }
  }, [props.className, props.children]);

  return <code {...props} ref={ref} />;
}

const Project = () => {
  const location = useLocation();
  const { user } = useContext(UserContext);

  const [project, setProject] = useState(location.state.project);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());

  const [fileTree, setFileTree] = useState({});
  const [currentFile, setCurrentFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);

  const [webContainer, setWebContainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [runProcess, setRunProcess] = useState(null);
  const [hasInstalledDeps, setHasInstalledDeps] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState("");

  const resetRun = async () => {
    try {
      if (runProcess) {
        try {
          runProcess.kill();
        } catch {}
      }
      setIframeUrl(null);
      setRunOutput("");
      setIsRunning(false);
    } catch (e) {
      console.log("Reset error", e);
    }
  };

  const messageBox = useRef(null);

  // 🔍 Debug: see what fileTree looks like in the console
  useEffect(() => {
    console.log("📁 CURRENT FILETREE:", fileTree);
  }, [fileTree]);

  const handleUserClick = (id) => {
    setSelectedUserId((prev) => {
      const updated = new Set(prev);
      updated.has(id) ? updated.delete(id) : updated.add(id);
      return updated;
    });
  };

  const addCollaborators = async () => {
    try {
      await axios.put("/projects/add-user", {
        projectId: project._id,
        users: Array.from(selectedUserId),
      });
      setIsModalOpen(false);
      setSelectedUserId(new Set());
    } catch (err) {
      console.log(err);
    }
  };

  const send = () => {
    if (!message.trim()) return;
    const localMsg = { sender: user, message };
    sendMessage("project-message", localMsg);
    setMessages((prev) => [...prev, localMsg]);
    setMessage("");
  };

  const WriteAiMessage = (text) => {
    const parsed = JSON.parse(text);
    return (
      <div className="overflow-auto bg-slate-900 text-slate-100 p-2 rounded border border-slate-600">
        <Markdown
          children={parsed.text}
          options={{
            overrides: { code: SyntaxHighlightedCode },
          }}
        />
      </div>
    );
  };

  useEffect(() => {
    // 🔌 Socket setup
    initializeSocket(project._id);

    receiveMessage("project-message", (data) => {
      setMessages((prev) => [...prev, data]);

      if (data.sender._id === "ai") {
        const parsed = JSON.parse(data.message);
        if (parsed.fileTree) {
          // AI sent a new project structure
          setFileTree(parsed.fileTree);
          if (webContainer) {
            webContainer.mount(parsed.fileTree);
          }
        }
      }
    });

    // 🔁 Fetch updated project (including fileTree) from backend
    axios
      .get(`/projects/get-project/${location.state.project._id}`)
      .then((res) => {
        setProject(res.data.project);
        setFileTree(res.data.project.fileTree || {});
      })
      .catch((err) => {
        console.log("Error fetching project by id:", err?.response?.data || err);
      });

    // 👥 Fetch users list
    axios
      .get("/users/all")
      .then((res) => {
        setUsers(res.data.users || []);
      })
      .catch(() => setUsersError("Failed to fetch user list"));

    // 🧠 Optionally boot WebContainer early
    if (!webContainer) {
      getWebContainer().then((container) => setWebContainer(container));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFileTree = (ft) => {
    axios.put("/projects/update-file-tree", {
      projectId: project._id,
      fileTree: ft,
    });
  };

  useEffect(() => {
    if (messageBox.current)
      messageBox.current.scrollTop = messageBox.current.scrollHeight;
  }, [messages]);

  // ▶ MAIN RUN LOGIC
  const handleRun = async () => {
    try {
      setIsRunning(true);
      setIframeUrl(null);
      setRunOutput("");

      // 1. Ensure WebContainer exists
      let container = webContainer;
      if (!container) {
        container = await getWebContainer();
        setWebContainer(container);
      }

      // 2. Mount the latest fileTree (AI + user edits)
      await container.mount(fileTree);

      // 3. Install dependencies only when package.json exists
      const pkgContentForInstall =
        fileTree["package.json"]?.file?.contents || null;
      if (pkgContentForInstall && !hasInstalledDeps) {
        try {
          const install = await container.spawn("npm", ["install"]);
          install.output.pipeTo(
            new WritableStream({
              write(data) {
                setRunOutput((prev) => prev + String(data));
              },
            })
          );
          const exitCode = await install.exit;
          if (exitCode !== 0) {
            setRunOutput((prev) => prev + "\nInstall failed\n");
            setIsRunning(false);
            return;
          }
          setHasInstalledDeps(true);
        } catch (e) {
          setRunOutput((prev) => prev + "\nInstall error\n");
        }
      } else if (!pkgContentForInstall) {
        setRunOutput(
          (prev) => prev + "No package.json — skipping npm install\n"
        );
      }

      // 4. Kill previous process if running
      if (runProcess) {
        try {
          runProcess.kill();
        } catch (e) {
          console.warn("Failed to kill previous process", e);
        }
      }

      // 5. Listen for server-ready (URL for iframe)
      container.on("server-ready", (port, url) => {
        setIframeUrl(url);
      });

      const pkg = fileTree["package.json"]?.file?.contents || null;
      let exec;
      try {
        if (pkg) {
          const parsed = JSON.parse(pkg);
          const scripts = parsed?.scripts || {};
          if (scripts.start) {
            exec = await container.spawn("npm", ["run", "start"]);
          } else if (scripts.dev) {
            exec = await container.spawn("npm", ["run", "dev"]);
          }
        }
        if (!exec) {
          if (fileTree["app.js"])
            exec = await container.spawn("node", ["app.js"]);
          else if (fileTree["index.js"])
            exec = await container.spawn("node", ["index.js"]);
        }
        if (!exec) {
          const htmlFiles = Object.keys(fileTree).filter(
            (k) => k.toLowerCase().endsWith(".html") && fileTree[k]?.file
          );
          const defaultHtml = htmlFiles.includes("index.html")
            ? "index.html"
            : htmlFiles[0] || null;
          if (defaultHtml) {
            const staticServer = `const http=require('http');const fs=require('fs');const path=require('path');const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain'};const server=http.createServer((req,res)=>{let p=(req.url||'/').split('?')[0];if(p==='/')p='${defaultHtml}';if(p.startsWith('/'))p=p.slice(1);const f=path.join('.',p);fs.readFile(f,(e,d)=>{if(e){fs.readFile('${defaultHtml}',(e2,d2)=>{if(e2){res.statusCode=404;res.end('Not found');return;}res.setHeader('Content-Type','text/html');res.end(d2);});return;}const ext=path.extname(f).toLowerCase();res.setHeader('Content-Type',types[ext]||'application/octet-stream');res.end(d);});});server.listen(3000);`;
            await container.fs.writeFile(
              "__syntara_static_server.js",
              staticServer
            );
            exec = await container.spawn("node", [
              "__syntara_static_server.js",
            ]);
            setRunOutput(
              (prev) =>
                prev +
                `Static site detected — serving ${defaultHtml} on port 3000\n`
            );
          }
        }
        if (!exec) {
          const hasPython = Object.keys(fileTree).some(
            (k) => k.endsWith(".py") || k === "requirements.txt"
          );
          if (hasPython) {
            setRunOutput(
              (prev) =>
                prev +
                "Python apps are not supported in WebContainer.\nUse a local environment for Streamlit or Python servers.\n"
            );
            setIsRunning(false);
            return;
          }
        }
        if (!exec) {
          setRunOutput((prev) => prev + "\nNo start command found\n");
          setIsRunning(false);
          return;
        }
      } catch (e) {
        setRunOutput((prev) => prev + "\nFailed to parse package.json\n");
        setIsRunning(false);
        return;
      }
      exec.output.pipeTo(
        new WritableStream({
          write(data) {
            setRunOutput((prev) => prev + String(data));
          },
        })
      );
      setRunProcess(exec);
    } catch (err) {
      setRunOutput((prev) => prev + "\nRun error\n");
    } finally {
      setIsRunning(false);
    }
  };

  // ============================
  // 💡 NEW: Resizable layout state
  // ============================
  const [leftWidth, setLeftWidth] = useState(23 * 16); // ~23rem
  const [fileTreeWidth, setFileTreeWidth] = useState(56 * 4); // Tailwind w-56 ≈ 224px
  const [previewWidth, setPreviewWidth] = useState(72 * 4); // Tailwind w-72 ≈ 288px

  const [dragging, setDragging] = useState(null); // 'left' | 'fileTree' | 'preview' | null

  const layoutRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging) return;

      const layoutRect = layoutRef.current?.getBoundingClientRect();
      const rightRect = rightRef.current?.getBoundingClientRect();

      if (!layoutRect) return;

      if (dragging === "left") {
        // Distance from left edge of layout
        const newWidth = e.clientX - layoutRect.left;
        const clamped = Math.min(Math.max(newWidth, 240), 520); // min/max for chat panel
        setLeftWidth(clamped);
      }

      if (dragging === "fileTree" && rightRect) {
        const newWidth = e.clientX - rightRect.left;
        const clamped = Math.min(Math.max(newWidth, 160), 360);
        setFileTreeWidth(clamped);
      }

      if (dragging === "preview" && rightRect) {
        const newWidth = rightRect.right - e.clientX;
        const clamped = Math.min(Math.max(newWidth, 220), 480);
        setPreviewWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      if (dragging) setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  return (
    <main
      ref={layoutRef} // NEW
      className="h-screen w-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white"
    >
      {/* LEFT: Chat */}
      <section
        style={{ width: leftWidth }} // NEW
        className="min-w-[15rem] max-w-[32rem] border-r border-slate-800 flex flex-col"
      >
        <header className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{project.name}</h2>
            {project.owner && (
              <span className="text-[10px] rounded-full bg-indigo-600/30 px-2 py-0.5 text-indigo-200 uppercase tracking-wide">
                Owner:{" "}
                {project.owner.username ||
                  (project.owner.email
                    ? project.owner.email.split("@")[0]
                    : "")}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1 bg-purple-600 rounded-md text-sm"
          >
            + Add
          </button>
        </header>

        <div className="flex flex-col flex-grow overflow-hidden">
          <div
            ref={messageBox}
            className="message-box flex-grow overflow-auto space-y-3 p-4"
          >
            {messages.map((msg, i) => {
              const name = (
                msg.sender.username ||
                msg.sender.email ||
                "AI"
              ).toString();
              const initial = name.charAt(0).toUpperCase();
              const isSelf = msg.sender._id === user._id;
              const isAi = msg.sender._id === "ai";
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${
                    isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isSelf && (
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                        isAi ? "bg-purple-600" : "bg-slate-700"
                      }`}
                    >
                      {initial}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isAi
                        ? "bg-gradient-to-br from-purple-700/40 to-indigo-700/40 border border-purple-400/50"
                        : isSelf
                        ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                        : "bg-slate-800"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-medium ${
                        isSelf ? "text-white/80" : "text-slate-300/80"
                      }`}
                    >
                      {name}
                    </div>
                    <div className="mt-1 text-sm">
                      {isAi ? WriteAiMessage(msg.message) : msg.message}
                    </div>
                  </div>
                  {isSelf && (
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs bg-indigo-600">
                      {(user.username || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex p-2 border-t border-slate-800 bg-slate-900">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message Syntara... use @ai for assistant"
              className="flex-grow bg-slate-800 text-white px-3 py-2 rounded-l"
            />
            <button onClick={send} className="px-4 bg-purple-600 rounded-r">
              <i className="ri-send-plane-2-fill" />
            </button>
          </div>
        </div>
      </section>

      {/* NEW: Resizer between Chat and Code */}
      <div
        className="w-1 cursor-col-resize bg-slate-800/60 hover:bg-slate-500/80 transition-colors"
        onMouseDown={() => setDragging("left")}
      />

      {/* RIGHT: Code + Preview */}
      <section ref={rightRef} className="flex-grow flex">
        {/* File Tree */}
        <aside
          style={{ width: fileTreeWidth }} // NEW
          className="min-w-[10rem] max-w-[22rem] border-r border-slate-800 bg-slate-900"
        >
          <h3 className="px-3 py-2 border-b border-slate-800 text-sm uppercase tracking-wide text-slate-400">
            Files
          </h3>
          <div className="px-3 py-2 flex gap-2 border-b border-slate-800">
            <button
              className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              onClick={async () => {
                const name = prompt(
                  "New file path (e.g., index.html or src/app.js)"
                );
                if (!name) return;
                const trimmed = name.trim();
                if (!trimmed) return;
                if (fileTree[trimmed]) return;

                const newTree = {
                  ...fileTree,
                  [trimmed]: { file: { contents: "" } },
                };
                setFileTree(newTree);
                saveFileTree(newTree);

                try {
                  if (webContainer) {
                    const parts = trimmed.split("/");
                    if (parts.length > 1) {
                      const dirPath = parts.slice(0, -1).join("/");
                      try {
                        await webContainer.fs.mkdir(dirPath, {
                          recursive: true,
                        });
                      } catch {}
                    }
                    await webContainer.fs.writeFile(trimmed, "");
                  }
                } catch (e) {
                  console.log(
                    "Failed to create file in WebContainer",
                    e
                  );
                }

                setCurrentFile(trimmed);
                setOpenFiles((prev) => [...new Set([...prev, trimmed])]);
              }}
            >
              New File
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              onClick={async () => {
                const name = prompt(
                  "New folder path (e.g., src or assets/images)"
                );
                if (!name) return;
                let trimmed = name.trim();
                if (!trimmed) return;
                // normalize: no leading './', ensure no trailing spaces
                trimmed = trimmed.replace(/^\.\//, "");
                if (fileTree[trimmed]) return;

                const newTree = {
                  ...fileTree,
                  [trimmed]: { directory: {} },
                };
                setFileTree(newTree);
                saveFileTree(newTree);

                try {
                  if (webContainer) {
                    await webContainer.fs.mkdir(trimmed, {
                      recursive: true,
                    });
                  }
                } catch (e) {
                  console.log(
                    "Failed to create folder in WebContainer",
                    e
                  );
                }
              }}
            >
              New Folder
            </button>
          </div>
          {Object.keys(fileTree).map((file) => (
            <button
              key={file}
              className="w-full text-left px-4 py-2 hover:bg-slate-800 text-xs truncate"
              onClick={() => {
                setCurrentFile(file);
                setOpenFiles((prev) => [...new Set([...prev, file])]);
              }}
            >
              {fileTree[file]?.file ? "📄" : "📁"} {file}
            </button>
          ))}
        </aside>

        {/* NEW: Resizer between File Tree and Editor */}
        <div
          className="w-1 cursor-col-resize bg-slate-800/60 hover:bg-slate-500/80 transition-colors"
          onMouseDown={() => setDragging("fileTree")}
        />

        {/* Editor + Run */}
        <div className="flex flex-col flex-grow">
          <div className="flex justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex gap-2 overflow-x-auto max-w-full pr-4">
              {openFiles.map((file) => (
                <button
                  key={file}
                  className={`px-3 py-1 rounded-md text-xs whitespace-nowrap ${
                    file === currentFile ? "bg-purple-500" : "bg-slate-700"
                  }`}
                  onClick={() => setCurrentFile(file)}
                >
                  {file}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="px-4 py-1 rounded-md bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isRunning ? "Running..." : "▶ Run"}
              </button>
              {iframeUrl && (
                <button
                  onClick={() => {
                    try {
                      window.open(iframeUrl, "_blank", "noopener");
                    } catch {}
                  }}
                  className="px-4 py-1 rounded-md bg-slate-700 text-sm"
                >
                  Open Preview
                </button>
              )}
            </div>
          </div>

          {/* Editable Code */}
          {currentFile && fileTree[currentFile] && (
            <pre className="flex-grow overflow-auto bg-black text-white p-3 text-sm">
              <code
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={async (e) => {
                  const updated = e.target.innerText;

                  const newTree = {
                    ...fileTree,
                    [currentFile]: { file: { contents: updated } },
                  };

                  // Update state + backend
                  setFileTree(newTree);
                  saveFileTree(newTree);

                  // Keep WebContainer in sync so next Run uses latest code
                  if (webContainer) {
                    try {
                      await webContainer.fs.writeFile(
                        currentFile,
                        updated
                      );
                    } catch (err) {
                      console.error(
                        "Error writing file to WebContainer:",
                        err
                      );
                    }
                  }
                }}
              >
                {fileTree[currentFile]?.file?.contents}
              </code>
            </pre>
          )}
        </div>

        {/* Preview / Logs with resizer */}
        {iframeUrl && (
          <>
            <div
              className="w-1 cursor-col-resize bg-slate-800/60 hover:bg-slate-500/80 transition-colors"
              onMouseDown={() => setDragging("preview")}
            />
            <div
              style={{ width: previewWidth }}
              className="min-w-[14rem] max-w-[32rem] border-l border-slate-800 bg-slate-900"
            >
              <iframe
                src={iframeUrl}
                className="w-full h-full"
                title="preview"
              />
            </div>
          </>
        )}
        {!iframeUrl && runOutput && (
          <>
            <div
              className="w-1 cursor-col-resize bg-slate-800/60 hover:bg-slate-500/80 transition-colors"
              onMouseDown={() => setDragging("preview")}
            />
            <div
              style={{ width: previewWidth }}
              className="min-w-[14rem] max-w-[32rem] border-l border-slate-800 bg-slate-900 p-3 text-xs whitespace-pre-wrap"
            >
              {runOutput}
            </div>
          </>
        )}
      </section>

      {/* MODAL: Add Collaborators */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center">
          <div className="bg-slate-900 p-5 rounded-lg w-96 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">Add Collaborators</h2>

            {usersError && (
              <p className="text-red-400 text-xs">{usersError}</p>
            )}

            {!usersError && users.length === 0 && (
              <p className="text-gray-400 text-sm">No users found.</p>
            )}

            <div className="space-y-2 h-48 overflow-auto">
              {users.map((u) => (
                <div
                  key={u._id}
                  onClick={() => handleUserClick(u._id)}
                  className={`p-2 rounded-md cursor-pointer ${
                    selectedUserId.has(u._id)
                      ? "bg-purple-600"
                      : "bg-slate-800"
                  }`}
                >
                  {u.username || u.email}
                </div>
              ))}
            </div>

            <button
              onClick={addCollaborators}
              className="mt-4 w-full bg-purple-600 py-2 rounded-md"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Project;
