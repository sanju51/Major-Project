import { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../context/user.context";
import { useTheme } from "../context/theme.context";
import { useLocation, useNavigate } from "react-router-dom";
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

const FileItem = ({ file, isDirectory, onOpen, onDelete, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.split('/').pop());

  const handleRename = () => {
    if (newName && newName !== file.split('/').pop()) {
      onRename(file, newName);
    }
    setIsRenaming(false);
  };

  const fileName = file.split('/').pop();

  return (
    <div className="group flex items-center justify-between hover:bg-slate-800 transition-colors px-4 py-1.5 cursor-pointer">
      <div className="flex items-center gap-2 flex-grow overflow-hidden" onClick={() => !isDirectory && onOpen(file)}>
        <span className="text-lg">
          {isDirectory ? (
            <i className="ri-folder-fill text-amber-400" />
          ) : (
            <i className={fileName.endsWith('.js') || fileName.endsWith('.jsx') ? 'ri-javascript-fill text-yellow-400' : 
                          fileName.endsWith('.css') ? 'ri-css3-fill text-blue-400' : 
                          fileName.endsWith('.html') ? 'ri-html5-fill text-orange-400' : 
                          'ri-file-text-line text-slate-400'} />
          )}
        </span>
        {isRenaming ? (
          <input
            autoFocus
            className="bg-slate-700 text-xs px-1 rounded outline-none w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
        ) : (
          <span className="text-xs text-slate-300 truncate font-medium">{fileName}</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
          className="p-1 hover:text-indigo-400 transition"
          title="Rename"
        >
          <i className="ri-edit-line text-xs" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
          className="p-1 hover:text-red-500 transition"
          title="Delete"
        >
          <i className="ri-delete-bin-line text-xs" />
        </button>
      </div>
    </div>
  );
};

const RecursiveFileTree = ({ tree, path = "", onOpen, onDelete, onRename }) => {
  return (
    <div className={path ? "pl-4" : ""}>
      {Object.keys(tree).sort().map((key) => {
        const fullPath = path ? `${path}/${key}` : key;
        const isDirectory = !!tree[key].directory;

        return (
          <div key={fullPath}>
            <FileItem
              file={fullPath}
              isDirectory={isDirectory}
              onOpen={onOpen}
              onDelete={onDelete}
              onRename={onRename}
            />
            {isDirectory && tree[key].directory && (
              <RecursiveFileTree
                tree={tree[key].directory}
                path={fullPath}
                onOpen={onOpen}
                onDelete={onDelete}
                onRename={onRename}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const Project = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { theme, toggleTheme } = useTheme();

  const [project, setProject] = useState(location.state.project);
  const isOwner = (project.owner?._id || project.owner) === user._id;
  const userRole = project.users?.find(u => (u.user._id || u.user) === user._id)?.role || (isOwner ? 'owner' : 'viewer');
  const isAuthorizedToAdd = ['owner', 'admin'].includes(userRole);
  const isAuthorizedToEdit = ['owner', 'admin', 'developer', 'tester'].includes(userRole);

  const [messages, setMessages] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState({}); // { [userId]: role }

  const [fileTree, setFileTree] = useState({});
  const [currentFile, setCurrentFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);

  const [webContainer, setWebContainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [runProcess, setRunProcess] = useState(null);
  const [hasInstalledDeps, setHasInstalledDeps] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  const handleUserClick = (id) => {
    setSelectedUsers((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        delete updated[id];
      } else {
        updated[id] = "viewer";
      }
      return updated;
    });
  };

  const handleRoleChange = (userId, role) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [userId]: role,
    }));
  };

  const addCollaborators = async () => {
    try {
      const usersPayload = Object.entries(selectedUsers).map(([userId, role]) => ({
        userId,
        role,
      }));

      const res = await axios.put("/projects/add-user", {
        projectId: project._id,
        users: usersPayload,
      });

      if (res.data.project) {
        setProject(res.data.project);
      }
      setIsModalOpen(false);
      setSelectedUsers({});
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm("Are you sure you want to delete this entire project? This action cannot be undone.")) return;
    
    try {
      setIsDeleting(true);
      await axios.delete(`/projects/${project._id}`);
      navigate('/');
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Error deleting project. Make sure you are the owner.");
    } finally {
      setIsDeleting(false);
    }
  };

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleDownloadReport = async () => {
    try {
      setIsGeneratingReport(true);
      
      const reportPrompt = `Generate a detailed professional project report for "${project.name}". 
      Description: ${project.description}
      Include sections for: Project Overview, File Structure Summary, and Task Status.
      Format it as a clean text-based report.`;
      
      const response = await axios.post("/ai/get-result", { prompt: reportPrompt });
      const reportText = typeof response.data === 'string' ? response.data : response.data.text || JSON.stringify(response.data);
      
      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_Report.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to generate report:", err);
      alert("Error generating report with AI.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

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

  useEffect(() => {
    const socket = initializeSocket(project._id);

    receiveMessage("project-message", (data) => {
      setMessages((prev) => {
        const filtered = prev.filter(m => !m.isStreaming);
        return [...filtered, data];
      });

      if (data.sender._id === "ai") {
        try {
          const parsed = JSON.parse(data.message);
          if (parsed.fileTree) {
            setFileTree(prev => {
              const newTree = { ...prev, ...parsed.fileTree };
              if (webContainer) {
                webContainer.mount(newTree);
              }
              return newTree;
            });
          }
        } catch (e) {
          console.error("Failed to parse AI message for fileTree:", e);
        }
      }
    });

    socket.on("ai-chunk", ({ chunk }) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.sender._id === "ai" && lastMsg.isStreaming) {
          const updatedMsg = { ...lastMsg, message: lastMsg.message + chunk };
          return [...prev.slice(0, -1), updatedMsg];
        } else {
          return [...prev, {
            sender: { _id: "ai", username: "AI", email: "AI" },
            message: chunk,
            isStreaming: true
          }];
        }
      });
    });

    axios.get(`/projects/get-project/${location.state.project._id}`)
      .then((res) => {
        setProject(res.data.project);
        setFileTree(res.data.project.fileTree || {});
      });

    axios.get(`/analytics/project/${location.state.project._id}`)
      .then((res) => setAnalytics(res.data));

    axios.get("/users/all")
      .then((res) => setUsers(res.data.users || []));

    if (!webContainer) {
      getWebContainer().then((container) => setWebContainer(container));
    }
  }, []);

  const saveFileTree = (ft) => {
    axios.put("/projects/update-file-tree", {
      projectId: project._id,
      fileTree: ft,
    });
  };

  const handleRenameFile = async (oldPath, newName) => {
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    if (fileTree[newPath]) return;

    const newTree = { ...fileTree };
    const content = newTree[oldPath];
    delete newTree[oldPath];
    newTree[newPath] = content;
    setFileTree(newTree);
    saveFileTree(newTree);

    if (currentFile === oldPath) setCurrentFile(newPath);
    setOpenFiles(prev => prev.map(f => f === oldPath ? newPath : f));
  };

  const handleRun = async () => {
    try {
      setIsRunning(true);
      setIframeUrl(null);
      setRunOutput("Initializing WebContainer...\n");
      
      let container = webContainer || await getWebContainer();
      setWebContainer(container);

      const validTree = {};
      Object.keys(fileTree).forEach(key => {
        if (fileTree[key] && (fileTree[key].file || fileTree[key].directory)) {
          validTree[key] = fileTree[key];
        }
      });
      
      await container.mount(validTree);
      setRunOutput(prev => prev + "📁 Files mounted successfully.\n");

      const pkgContentForInstall = validTree["package.json"]?.file?.contents || null;
      
      if (pkgContentForInstall) {
        if (!hasInstalledDeps) {
          setRunOutput(prev => prev + "📦 package.json found. Installing dependencies...\n");
          const install = await container.spawn("npm", ["install"]);
          install.output.pipeTo(new WritableStream({ 
            write(data) { setRunOutput(prev => prev + String(data)); } 
          }));
          const exitCode = await install.exit;
          if (exitCode !== 0) {
            setRunOutput(prev => prev + "\n❌ Install failed. Check your package.json.\n");
            setIsRunning(false);
            return;
          }
          setHasInstalledDeps(true);
          setRunOutput(prev => prev + "✅ Dependencies installed.\n");
        }
        
        setRunOutput(prev => prev + "⚡ Starting application (npm start)...\n");
        
        // 🚀 FIX: Correct event handling for server-ready
        container.on("server-ready", (port, url) => {
          setIframeUrl(url);
          setRunOutput(prev => prev + `🌐 Server ready at ${url}\n`);
        });

        const exec = await container.spawn("npm", ["start"]);
        exec.output.pipeTo(new WritableStream({ 
          write(data) { setRunOutput(prev => prev + String(data)); } 
        }));
        setRunProcess(exec);
      } else if (validTree["index.html"] || Object.keys(validTree).some(k => k.endsWith('.html'))) {
        const htmlFile = validTree["index.html"] ? "index.html" : Object.keys(validTree).find(k => k.endsWith('.html'));
        setRunOutput(prev => prev + `ℹ️ No package.json found. Serving ${htmlFile} using static server...\n`);
        
        container.on("server-ready", (port, url) => {
          setIframeUrl(url);
          setRunOutput(prev => prev + `🌐 Preview ready at ${url}\n`);
        });

        const exec = await container.spawn("npx", ["-y", "serve", "-l", "3000"]);
        exec.output.pipeTo(new WritableStream({ 
          write(data) { setRunOutput(prev => prev + String(data)); } 
        }));
        setRunProcess(exec);
      } else {
        setRunOutput(prev => prev + "❌ Error: No package.json or HTML file found. Nothing to run.\n");
      }
    } catch (err) {
      console.error("Run error:", err);
      setRunOutput(prev => prev + `\n❌ Run error: ${err.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const [leftWidth, setLeftWidth] = useState(23 * 16);
  const [fileTreeWidth, setFileTreeWidth] = useState(224);
  const [previewWidth, setPreviewWidth] = useState(288);
  const [dragging, setDragging] = useState(null);
  const layoutRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging) return;
      const layoutRect = layoutRef.current?.getBoundingClientRect();
      const rightRect = rightRef.current?.getBoundingClientRect();
      if (dragging === "left") setLeftWidth(Math.min(Math.max(e.clientX - layoutRect.left, 240), 520));
      if (dragging === "fileTree") setFileTreeWidth(Math.min(Math.max(e.clientX - rightRect.left, 160), 360));
      if (dragging === "preview") setPreviewWidth(Math.min(Math.max(rightRect.right - e.clientX, 220), 480));
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const WriteAiMessage = (text, isStreaming = false) => {
    if (isStreaming) {
      let displayMsg = text;
      const match = text.match(/"text"\s*:\s*"([^"]*)"/);
      if (match && match[1]) displayMsg = match[1];
      return <div className="bg-slate-900 p-2 rounded border border-slate-600"><p className="text-sm">{displayMsg}</p></div>;
    }
    try {
      const parsed = JSON.parse(text);
      return <div className="bg-slate-900 p-2 rounded border border-slate-600"><Markdown children={parsed.text || text} /></div>;
    } catch (e) {
      return <div className="bg-slate-900 p-2 rounded border border-slate-600"><p className="text-sm">{text}</p></div>;
    }
  };

  const buildTree = (flatTree) => {
    const tree = {};
    Object.keys(flatTree).forEach((path) => {
      const parts = path.split("/");
      let current = tree;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) current[part] = flatTree[path];
        else {
          if (!current[part]) current[part] = { directory: {} };
          current = current[part].directory;
        }
      });
    });
    return tree;
  };

  return (
    <main ref={layoutRef} className="h-screen w-screen flex bg-slate-950 text-white">
      <section style={{ width: leftWidth }} className="flex flex-col border-r border-slate-800">
        <header className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-indigo-400">{project.name}</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/project-dashboard', { state: { project } })} className="p-2 bg-slate-800 rounded">Board</button>
            {isAuthorizedToAdd && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-2 bg-indigo-600 rounded text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-700 transition"
              >
                + Add
              </button>
            )}
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition"
              title="Project Details"
            >
              <i className="ri-information-line text-indigo-400" />
            </button>
            <button onClick={handleDeleteProject} className="p-2 bg-red-900/50 text-red-400 rounded hover:bg-red-900"><i className="ri-delete-bin-line" /></button>
            <button onClick={handleDownloadReport} className="p-2 bg-indigo-900/50 text-indigo-400 rounded hover:bg-indigo-900"><i className="ri-file-download-line" /></button>
          </div>
        </header>
        <div ref={messageBox} className="flex-grow overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender._id === user._id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender._id === user._id ? "bg-indigo-600" : "bg-slate-800"}`}>
                <div className="text-[10px] opacity-50 mb-1">{msg.sender.username || "AI"}</div>
                {msg.sender._id === "ai" ? WriteAiMessage(msg.message, msg.isStreaming) : msg.message}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800 flex">
          <input value={message} onChange={(e) => setMessage(e.target.value)} className="flex-grow bg-slate-900 p-2 rounded-l outline-none" placeholder="Message..." />
          <button onClick={() => { sendMessage("project-message", { sender: user, message }); setMessages(prev => [...prev, { sender: user, message }]); setMessage(""); }} className="bg-indigo-600 px-4 rounded-r">Send</button>
        </div>

        {/* Project Info Side Panel Overlay */}
        {isSidePanelOpen && (
          <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col border-r border-slate-800 animate-in slide-in-from-left duration-300">
            <header className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900">
              <h2 className="font-bold flex items-center gap-2 text-indigo-400">
                <i className="ri-information-line" />
                Documentation
              </h2>
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="p-1 hover:bg-slate-800 rounded transition"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </header>

            <div className="flex-grow overflow-auto p-5 space-y-8">
              <section>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4 font-extrabold">Team & Roles</h3>
                <div className="space-y-3">
                  {project.users?.map((u, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-2xl p-3.5 group hover:border-indigo-500/30 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
                          {(u.user.username || u.user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-100">{u.user.username || u.user.email}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{u.user.email}</div>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-widest font-extrabold shadow-sm ${
                        u.role === 'owner' ? 'bg-indigo-500/10 text-indigo-400' :
                        u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4 font-extrabold">Overview</h3>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                  <h4 className="text-base font-bold text-indigo-300">{project.name}</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-medium">
                    {project.description || "This platform integrates code execution, real-time collaboration, and project management into a single unified workspace."}
                  </p>
                </div>
              </section>
            </div>

            <div className="p-5 border-t border-slate-800">
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="w-full py-3 bg-white text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition shadow-lg"
              >
                Close Documentation
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="w-1 cursor-col-resize bg-slate-800 hover:bg-indigo-500" onMouseDown={() => setDragging("left")} />
      <section ref={rightRef} className="flex-grow flex">
        <aside style={{ width: fileTreeWidth }} className="bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Files</span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => {
                  const name = prompt("Enter file name (e.g., index.html)");
                  if (name) {
                    const newTree = { ...fileTree, [name]: { file: { contents: "" } } };
                    setFileTree(newTree);
                    saveFileTree(newTree);
                    setCurrentFile(name);
                    setOpenFiles(prev => [...new Set([...prev, name])]);
                  }
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                title="New File"
              >
                <i className="ri-file-add-line text-sm" />
              </button>
              <button 
                onClick={() => {
                  const name = prompt("Enter folder name");
                  if (name) {
                    const newTree = { ...fileTree, [name]: { directory: {} } };
                    setFileTree(newTree);
                    saveFileTree(newTree);
                  }
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition"
                title="New Folder"
              >
                <i className="ri-folder-add-line text-sm" />
              </button>
            </div>
          </div>
          <div className="flex-grow overflow-auto py-2 scrollbar-hide">
            <RecursiveFileTree 
              tree={buildTree(fileTree)} 
              onOpen={(f) => { 
                setCurrentFile(f); 
                setOpenFiles(prev => [...new Set([...prev, f])]); 
              }}
              onDelete={async (f) => {
                if (!confirm(`Are you sure you want to delete ${f}?`)) return;
                const newTree = { ...fileTree };
                delete newTree[f];
                Object.keys(newTree).forEach(key => {
                  if (key.startsWith(f + '/')) delete newTree[key];
                });
                setFileTree(newTree);
                saveFileTree(newTree);
                if (currentFile === f) setCurrentFile(null);
                setOpenFiles(prev => prev.filter(file => file !== f));
              }}
              onRename={handleRenameFile}
            />
          </div>
        </aside>
        <div className="w-1 cursor-col-resize bg-slate-800 hover:bg-indigo-500" onMouseDown={() => setDragging("fileTree")} />
        <div className="flex-grow flex flex-col">
          <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex gap-2">
              {openFiles.map(f => (
                <div key={f} onClick={() => setCurrentFile(f)} className={`px-3 py-1 rounded text-xs cursor-pointer ${f === currentFile ? "bg-indigo-600" : "bg-slate-800"}`}>{f.split('/').pop()}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleRun} 
                disabled={isRunning}
                className={`px-4 py-1 rounded text-sm font-bold transition ${
                  isRunning ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                }`}
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin" />
                    Running...
                  </span>
                ) : "Run"}
              </button>
              {iframeUrl && (
                <button 
                  onClick={() => window.open(iframeUrl, '_blank')}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm font-bold transition flex items-center gap-1.5"
                >
                  <i className="ri-external-link-line" />
                  Open Preview
                </button>
              )}
            </div>
          </div>
          <div className="flex-grow relative bg-black flex flex-col">
            <div className="flex-grow relative">
              {currentFile && fileTree[currentFile] ? (
                <pre className="absolute inset-0 p-4 overflow-auto text-sm"><code contentEditable={isAuthorizedToEdit} suppressContentEditableWarning className="outline-none block min-h-full whitespace-pre" onBlur={(e) => { const nt = { ...fileTree, [currentFile]: { ...fileTree[currentFile], file: { contents: e.target.innerText } } }; setFileTree(nt); saveFileTree(nt); }}>{fileTree[currentFile].file?.contents}</code></pre>
              ) : <div className="h-full flex items-center justify-center text-slate-700">Select a file</div>}
            </div>
            
            {/* Terminal / Output Section */}
            {runOutput && (
              <div className="h-32 bg-slate-900 border-t border-slate-800 flex flex-col">
                <div className="px-4 py-1.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Output</span>
                  <button onClick={() => setRunOutput("")} className="text-slate-500 hover:text-white"><i className="ri-close-line" /></button>
                </div>
                <pre className="flex-grow p-3 overflow-auto text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {runOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
        {iframeUrl && (
          <>
            <div 
              className="w-1 cursor-col-resize bg-slate-800 hover:bg-indigo-500 transition-colors z-10" 
              onMouseDown={() => setDragging("preview")} 
            />
            <div style={{ width: previewWidth }} className="border-l border-slate-800 bg-white relative">
              <iframe src={iframeUrl} className="w-full h-full" />
            </div>
          </>
        )}
      </section>

      <AddCollaboratorsModal 
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        users={users}
        usersError={usersError}
        selectedUsers={selectedUsers}
        handleUserClick={handleUserClick}
        handleRoleChange={handleRoleChange}
        addCollaborators={addCollaborators}
      />
    </main>
  );
};

const AddCollaboratorsModal = ({ isModalOpen, setIsModalOpen, users, usersError, selectedUsers, handleUserClick, handleRoleChange, addCollaborators }) => {
  if (!isModalOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Add Collaborators</h2>
          <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
            <i className="ri-close-line text-2xl" />
          </button>
        </div>

        {usersError && (
          <p className="text-red-400 text-xs mb-4 bg-red-400/10 p-2 rounded border border-red-400/20">{usersError}</p>
        )}

        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {users.map((u) => (
            <div
              key={u._id}
              className={`p-3 rounded-xl border transition-all ${
                selectedUsers[u._id] 
                ? "bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/20" 
                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
              }`}
            >
              <div 
                onClick={() => handleUserClick(u._id)}
                className="flex justify-between items-center cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                    {(u.username || u.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{u.username || u.email}</span>
                </div>
                {selectedUsers[u._id] && <i className="ri-checkbox-circle-fill text-indigo-400 text-lg" />}
              </div>
              
              {selectedUsers[u._id] && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-indigo-500/20">
                  <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Assign Role:</span>
                  <select 
                    value={selectedUsers[u._id]}
                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    className="bg-slate-900 text-xs border border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 transition-colors flex-grow"
                  >
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="tester">Tester</option>
                    <option value="developer">Developer (Edit Access)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && !usersError && (
            <div className="text-center py-8 text-slate-500">
              <i className="ri-user-search-line text-3xl mb-2 block" />
              <p className="text-sm">No other users found to add.</p>
            </div>
          )}
        </div>

        <button
          onClick={addCollaborators}
          disabled={Object.keys(selectedUsers).length === 0}
          className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
        >
          Add to Project
        </button>
      </div>
    </div>
  );
};

export default Project;
