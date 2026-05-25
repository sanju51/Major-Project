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

const Project = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { theme, toggleTheme } = useTheme();

  const [project, setProject] = useState(location.state.project);
  const userRole = project.users?.find(u => (u.user._id || u.user) === user._id)?.role || 'viewer';
  const isAuthorizedToAdd = ['owner', 'admin'].includes(userRole);

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

    axios
      .get(`/analytics/project/${location.state.project._id}`)
      .then((res) => {
        setAnalytics(res.data);
      })
      .catch((err) => {
        console.log("Error fetching analytics:", err);
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
      className="h-screen w-screen flex bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-indigo-900 text-slate-900 dark:text-white transition-colors duration-300"
    >
      {/* LEFT: Chat */}
      <section
        style={{ width: leftWidth }} // NEW
        className="min-w-[15rem] max-w-[32rem] border-r border-slate-200 dark:border-slate-800 flex flex-col"
      >
        <header className="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-indigo-600 dark:text-indigo-400">{project.name}</h2>
            {project.owner && (
              <span className="text-[10px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/30 px-2 py-0.5 text-indigo-600 dark:text-indigo-200 uppercase tracking-wide font-bold">
                Owner:{" "}
                {project.owner.username ||
                  (project.owner.email
                    ? project.owner.email.split("@")[0]
                    : "")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              <i className={theme === 'dark' ? 'ri-sun-line text-indigo-400' : 'ri-moon-line text-indigo-600'} />
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {(user?.username || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <i className="ri-arrow-down-s-line text-sm text-slate-500" />
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user?.username || 'User'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <i className="ri-user-line text-indigo-500" />
                  View Profile
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  <i className="ri-logout-box-line" />
                  Logout
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate('/project-dashboard', { state: { project } })}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 px-3"
              title="Kanban Board & Tasks"
            >
              <i className="ri-layout-grid-line text-indigo-500 dark:text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Board</span>
            </button>
            {isAuthorizedToAdd && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1 bg-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
              >
                + Add
              </button>
            )}
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Project Details"
            >
              <i className="ri-information-line text-lg text-indigo-500 dark:text-indigo-400" />
            </button>
          </div>
        </header>

        <div className="flex flex-col flex-grow overflow-hidden bg-white/50 dark:bg-transparent">
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
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isAi ? "bg-purple-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {initial}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                      isAi
                        ? "bg-purple-50 dark:bg-gradient-to-br dark:from-purple-700/40 dark:to-indigo-700/40 border border-purple-200 dark:border-purple-400/50 text-slate-800 dark:text-slate-100"
                        : isSelf
                        ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isSelf ? "text-white/80" : "text-indigo-600 dark:text-slate-300/80"
                      }`}
                    >
                      {name}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed">
                      {isAi ? WriteAiMessage(msg.message) : msg.message}
                    </div>
                  </div>
                  {isSelf && (
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-600 text-white">
                      {(user.username || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message ProjectPulse... use @ai for assistant"
              className="flex-grow bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2.5 rounded-l-xl text-sm focus:outline-none border border-slate-200 dark:border-slate-700 focus:border-indigo-500 transition"
            />
            <button onClick={send} className="px-5 bg-indigo-600 text-white rounded-r-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20">
              <i className="ri-send-plane-2-fill text-lg" />
            </button>
          </div>

          {/* Project Info Side Panel Overlay */}
          {isSidePanelOpen && (
            <div className="absolute inset-0 z-20 bg-white dark:bg-slate-950 flex flex-col border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-300">
              <header className="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <h2 className="font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <i className="ri-information-line" />
                  Documentation
                </h2>
                <button
                  onClick={() => setIsSidePanelOpen(false)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
                >
                  <i className="ri-close-line text-xl" />
                </button>
              </header>

              <div className="flex-grow overflow-auto p-5 space-y-8">
                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 font-extrabold">Team & Roles</h3>
                  <div className="space-y-3">
                    {project.users?.map((u, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 group hover:border-indigo-500/30 transition">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
                            {(u.user.username || u.user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{u.user.username || u.user.email}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{u.user.email}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-widest font-extrabold shadow-sm ${
                          u.role === 'owner' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                          u.role === 'admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 font-extrabold">Overview</h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                    <h4 className="text-base font-bold text-indigo-600 dark:text-indigo-300">{project.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                      {project.description || "This platform integrates code execution, real-time collaboration, and project management into a single unified workspace."}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 font-extrabold">Features</h3>
                  <div className="space-y-4">
                    {[
                      { icon: 'ri-code-s-slash-line', title: 'WebContainer', desc: 'Run Node.js environments directly in your browser securely.' },
                      { icon: 'ri-chat-smile-2-line', title: 'AI Assistant', desc: 'Integrated AI chat for code generation and debugging.' },
                      { icon: 'ri-group-line', title: 'Collaboration', desc: 'Real-time project sharing and role-based access control.' },
                      { icon: 'ri-layout-grid-line', title: 'Project Management', desc: 'Track status, priority, and timeline of your projects.' },
                    ].map((f, i) => (
                      <div key={i} className="flex gap-4 items-start group">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                          <i className={`${f.icon} text-indigo-600 dark:text-indigo-400`} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{f.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4 font-extrabold">Shortcuts</h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Run Code</span>
                      <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-400">Ctrl+Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Save File</span>
                      <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-400">Ctrl+S</kbd>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-5 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setIsSidePanelOpen(false)}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition shadow-lg"
                >
                  Close Documentation
                </button>
              </div>
            </div>
          )}
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
                const name = prompt("New file path (e.g., index.js or src/main.js)");
                if (!name) return;
                let trimmed = name.trim().replace(/^\.\//, "");
                if (!trimmed) return;

                // 📁 Handle nested creation automatically
                const newTree = { ...fileTree };
                const parts = trimmed.split("/");
                
                // If it's a nested file, ensure parent directories exist in state
                if (parts.length > 1) {
                  let currentPath = "";
                  for (let i = 0; i < parts.length - 1; i++) {
                    currentPath += (currentPath ? "/" : "") + parts[i];
                    if (!newTree[currentPath]) {
                      newTree[currentPath] = { directory: {} };
                    }
                  }
                }

                if (newTree[trimmed]) return;
                newTree[trimmed] = { file: { contents: "" } };
                
                setFileTree(newTree);
                saveFileTree(newTree);

                try {
                  if (webContainer) {
                    const dirPath = parts.slice(0, -1).join("/");
                    if (dirPath) {
                      await webContainer.fs.mkdir(dirPath, { recursive: true });
                    }
                    await webContainer.fs.writeFile(trimmed, "");
                  }
                } catch (e) {
                  console.error("WebContainer create file error:", e);
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
                const name = prompt("New folder path (e.g., src or assets/images)");
                if (!name) return;
                let trimmed = name.trim().replace(/^\.\//, "");
                if (!trimmed) return;

                const newTree = { ...fileTree };
                const parts = trimmed.split("/");
                let currentPath = "";
                
                for (const part of parts) {
                  currentPath += (currentPath ? "/" : "") + part;
                  if (!newTree[currentPath]) {
                    newTree[currentPath] = { directory: {} };
                  }
                }

                setFileTree(newTree);
                saveFileTree(newTree);

                try {
                  if (webContainer) {
                    await webContainer.fs.mkdir(trimmed, { recursive: true });
                  }
                } catch (e) {
                  console.error("WebContainer create folder error:", e);
                }
              }}
            >
              New Folder
            </button>
          </div>
          <div className="flex flex-col flex-grow overflow-auto">
            {Object.keys(fileTree).sort().map((file) => (
              <div key={file} className="group flex items-center justify-between hover:bg-slate-800 transition-colors px-4">
                <button
                  className="flex-grow text-left py-2 text-xs truncate flex items-center gap-2"
                  onClick={() => {
                    if (fileTree[file]?.file) {
                      setCurrentFile(file);
                      setOpenFiles((prev) => [...new Set([...prev, file])]);
                    }
                  }}
                >
                  <span className="text-sm">
                    {fileTree[file]?.file ? "📄" : "📁"}
                  </span>
                  <span className="truncate">{file}</span>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Are you sure you want to delete ${file}?`)) return;
                    
                    const newTree = { ...fileTree };
                    delete newTree[file];
                    setFileTree(newTree);
                    saveFileTree(newTree);

                    try {
                      if (webContainer) {
                        await webContainer.fs.rm(file, { recursive: true });
                      }
                    } catch (err) {
                      console.error("Failed to delete from WebContainer:", err);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  title="Delete"
                >
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>
            ))}
          </div>
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

            <div className="space-y-2 h-64 overflow-auto">
              {users.map((u) => (
                <div
                  key={u._id}
                  className={`p-2 rounded-md flex flex-col gap-2 ${
                    selectedUsers[u._id] ? "bg-slate-800 ring-1 ring-purple-500" : "bg-slate-800/50"
                  }`}
                >
                  <div 
                    onClick={() => handleUserClick(u._id)}
                    className="flex justify-between items-center cursor-pointer"
                  >
                    <span className="text-sm">{u.username || u.email}</span>
                    {selectedUsers[u._id] && <i className="ri-check-line text-purple-400" />}
                  </div>
                  
                  {selectedUsers[u._id] && (
                    <div className="flex items-center gap-2 mt-1 border-t border-slate-700 pt-2">
                      <span className="text-[10px] text-slate-400 uppercase">Role:</span>
                      <select 
                        value={selectedUsers[u._id]}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="bg-slate-900 text-xs border border-slate-700 rounded px-1 py-0.5 outline-none focus:border-purple-500"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="tester">Tester</option>
                        <option value="developer">Developer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}
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
