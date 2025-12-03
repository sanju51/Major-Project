import{ useState, useEffect, useContext, useRef } from "react";
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
      const pkgContentForInstall = fileTree["package.json"]?.file?.contents || null;
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
        setRunOutput((prev) => prev + "No package.json — skipping npm install\n");
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
          if (fileTree["app.js"]) exec = await container.spawn("node", ["app.js"]);
          else if (fileTree["index.js"]) exec = await container.spawn("node", ["index.js"]);
        }
        if (!exec) {
          const hasIndexHtml = Boolean(fileTree["index.html"]?.file?.contents);
          if (hasIndexHtml) {
            const staticServer = `const http=require('http');const fs=require('fs');const path=require('path');const mime=(p)=>{const x=path.extname(p).toLowerCase();return({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain'}[x]||'application/octet-stream')};const srv=http.createServer((req,res)=>{let url=(req.url||'/').split('?')[0];let f=url.startsWith('/')?url.slice(1):url;if(!f)f='index.html';if(f==='/')f='index.html';fs.readFile(f,(err,data)=>{if(err){res.statusCode=404;res.end('Not found');return;}res.setHeader('Content-Type',mime(f));res.end(data);});});srv.listen(3000);`;
            await container.fs.writeFile("__syntara_static_server.js", staticServer);
            exec = await container.spawn("node", ["__syntara_static_server.js"]);
          }
        }
        if (!exec) {
          const hasPython = Object.keys(fileTree).some((k) => k.endsWith('.py') || k === 'requirements.txt');
          if (hasPython) {
            setRunOutput((prev) => prev + "Python apps are not supported in WebContainer.\nUse a local environment for Streamlit or Python servers.\n");
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

  return (
    <main className="h-screen w-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white">
      {/* LEFT: Chat */}
      <section className="w-[23rem] border-r border-slate-800 flex flex-col">
        <header className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900">
          <h2 className="font-semibold">{project.name}</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1 bg-purple-600 rounded-md text-sm"
          >
            + Add
          </button>
        </header>

        <div className="flex flex-col flex-grow overflow-hidden">
          <div ref={messageBox} className="message-box flex-grow overflow-auto space-y-3 p-4">
            {messages.map((msg, i) => {
              const name = (msg.sender.username || msg.sender.email || "AI").toString();
              const initial = name.charAt(0).toUpperCase();
              const isSelf = msg.sender._id === user._id;
              const isAi = msg.sender._id === "ai";
              return (
                <div key={i} className={`flex items-start gap-2 ${isSelf ? "justify-end" : "justify-start"}`}>
                  {!isSelf && (
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs ${isAi ? "bg-purple-600" : "bg-slate-700"}`}>
                      {initial}
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    isAi
                      ? "bg-gradient-to-br from-purple-700/40 to-indigo-700/40 border border-purple-400/50"
                      : isSelf
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                      : "bg-slate-800"
                  }`}>
                    <div className={`text-[11px] font-medium ${isSelf ? "text-white/80" : "text-slate-300/80"}`}>
                      {name}
                    </div>
                    <div className="mt-1 text-sm">
                      {isAi ? WriteAiMessage(msg.message) : msg.message}
                    </div>
                  </div>
                  {isSelf && (
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs bg-indigo-600">
                      {(user.username || user.email || "U").charAt(0).toUpperCase()}
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

      {/* RIGHT: Code + Preview */}
      <section className="flex-grow flex">
        {/* File Tree */}
        <aside className="w-56 border-r border-slate-800 bg-slate-900">
          <h3 className="px-3 py-2 border-b border-slate-800 text-sm uppercase tracking-wide text-slate-400">
            Files
          </h3>
          {Object.keys(fileTree).map((file) => (
            <button
              key={file}
              className="w-full text-left px-4 py-2 hover:bg-slate-800"
              onClick={() => {
                setCurrentFile(file);
                setOpenFiles((prev) => [...new Set([...prev, file])]);
              }}
            >
              📄 {file}
            </button>
          ))}
        </aside>

        {/* Editor + Run */}
        <div className="flex flex-col flex-grow">
          <div className="flex justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex gap-2">
              {openFiles.map((file) => (
                <button
                  key={file}
                  className={`px-3 py-1 rounded-md ${
                    file === currentFile ? "bg-purple-500" : "bg-slate-700"
                  }`}
                  onClick={() => setCurrentFile(file)}
                >
                  {file}
                </button>
              ))}
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-4 py-1 rounded-md bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? "Running..." : "▶ Run"}
            </button>
            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-1 rounded-md bg-slate-700"
              >
                Open Preview
              </a>
            )}
          </div>

          {/* Editable Code */}
          {currentFile && fileTree[currentFile] && (
            <pre className="flex-grow overflow-auto bg-black text-white p-3">
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
                      await webContainer.fs.writeFile(currentFile, updated);
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

        {iframeUrl && (
          <div className="w-72 border-l border-slate-800 bg-slate-900">
            <iframe src={iframeUrl} className="w-full h-full" title="preview" />
          </div>
        )}
        {!iframeUrl && runOutput && (
          <div className="w-72 border-l border-slate-800 bg-slate-900 p-3 text-xs whitespace-pre-wrap">
            {runOutput}
          </div>
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
