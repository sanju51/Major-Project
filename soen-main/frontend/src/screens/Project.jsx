import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webcontainer'

function SyntaxHighlightedCode(props) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && props.className?.includes('lang-')) {
      hljs.highlightElement(ref.current)
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

const Project = () => {
  const location = useLocation()
  const { user } = useContext(UserContext)

  const [project, setProject] = useState(location.state.project)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [users, setUsers] = useState([])
  const [usersError, setUsersError] = useState('')
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(new Set())

  const [fileTree, setFileTree] = useState({})
  const [currentFile, setCurrentFile] = useState(null)
  const [openFiles, setOpenFiles] = useState([])

  const [webContainer, setWebContainer] = useState(null)
  const [iframeUrl, setIframeUrl] = useState(null)
  const [runProcess, setRunProcess] = useState(null)

  const messageBox = useRef(null)

  const handleUserClick = (id) => {
    setSelectedUserId(prev => {
      const updated = new Set(prev)
      updated.has(id) ? updated.delete(id) : updated.add(id)
      return updated
    })
  }

  const addCollaborators = async () => {
    try {
      await axios.put('/projects/add-user', {
        projectId: project._id,
        users: Array.from(selectedUserId),
      })
      setIsModalOpen(false)
      setSelectedUserId(new Set())
    } catch (err) {
      console.log(err)
    }
  }

  const send = () => {
    if (!message.trim()) return
    const localMsg = { sender: user, message }
    sendMessage('project-message', localMsg)
    setMessages(prev => [...prev, localMsg])
    setMessage('')
  }

  const WriteAiMessage = (text) => {
    const parsed = JSON.parse(text)
    return (
      <div className="overflow-auto bg-slate-900 text-slate-100 p-2 rounded border border-slate-600">
        <Markdown
          children={parsed.text}
          options={{
            overrides: { code: SyntaxHighlightedCode },
          }}
        />
      </div>
    )
  }

  useEffect(() => {
    initializeSocket(project._id)

    receiveMessage('project-message', (data) => {
      setMessages(prev => [...prev, data])
      if (data.sender._id === 'ai') {
        const parsed = JSON.parse(data.message)
        if (parsed.fileTree) {
          webContainer?.mount(parsed.fileTree)
          setFileTree(parsed.fileTree)
        }
      }
    })

    axios
  .get(`/projects/get-project/${location.state.project._id}`)
  .then(res => {
    console.log(res.data.project)
    setProject(res.data.project)
    setFileTree(res.data.project.fileTree || {})
  })
  .catch(err => {
    console.log('Error fetching project by id:', err?.response?.data || err)
    // fallback: keep using project from location.state
  })

    axios.get('/users/all')
      .then(res => {
        setUsers(res.data.users || [])
      })
      .catch(() => setUsersError('Failed to fetch user list'))

    if (!webContainer) {
      getWebContainer().then(container => setWebContainer(container))
    }
  }, [])

  const saveFileTree = (ft) => {
    axios.put('/projects/update-file-tree', { projectId: project._id, fileTree: ft })
  }

  useEffect(() => {
    if (messageBox.current)
      messageBox.current.scrollTop = messageBox.current.scrollHeight
  }, [messages])

  return (
    <main className="h-screen w-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white">

      {/* LEFT: Chat */}
      <section className="w-[23rem] border-r border-slate-800 flex flex-col">
        <header className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900">
          <h2 className="font-semibold">{project.name}</h2>
          <button onClick={() => setIsModalOpen(true)} className="px-3 py-1 bg-purple-600 rounded-md text-sm">
            + Add
          </button>
        </header>

        <div className="flex flex-col flex-grow overflow-hidden">
          <div ref={messageBox} className="flex-grow overflow-auto space-y-2 p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[75%] p-2 rounded-lg ${
                  msg.sender._id === 'ai'
                    ? "bg-purple-500/20 border border-purple-400"
                    : msg.sender._id === user._id
                    ? "ml-auto bg-blue-600"
                    : "bg-slate-700"
                }`}
              >
                <small className="opacity-70 text-xs">{msg.sender.email || "AI"}</small>
                <div className="mt-1 text-sm">
                  { msg.sender._id === 'ai' ? WriteAiMessage(msg.message) : msg.message }
                </div>
              </div>
            ))}
          </div>

          <div className="flex p-2 border-t border-slate-800 bg-slate-900">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message... Use @ai for assistant"
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
          {Object.keys(fileTree).map(file => (
            <button
              key={file}
              className="w-full text-left px-4 py-2 hover:bg-slate-800"
              onClick={() => {
                setCurrentFile(file)
                setOpenFiles(prev => [...new Set([...prev, file])])
              }}
            >
              📄 {file}
            </button>
          ))}
        </aside>

        {/* Editor */}
        <div className="flex flex-col flex-grow">
          <div className="flex justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex gap-2">
              {openFiles.map(file => (
                <button
                  key={file}
                  className={`px-3 py-1 rounded-md ${file === currentFile ? "bg-purple-500" : "bg-slate-700"}`}
                  onClick={() => setCurrentFile(file)}
                >
                  {file}
                </button>
              ))}
            </div>

            <button
              onClick={async () => {
                await webContainer.mount(fileTree)
                const p = await webContainer.spawn("npm", ["install"])
                p.output.pipeTo(new WritableStream({ write: data => console.log(data) }))

                if (runProcess) runProcess.kill()

                let exec = await webContainer.spawn("npm", ["start"])
                exec.output.pipeTo(new WritableStream({ write: data => console.log(data) }))

                setRunProcess(exec)

                webContainer.on("server-ready", (_, url) => setIframeUrl(url))
              }}
              className="px-4 py-1 rounded-md bg-emerald-500"
            >
              ▶ Run
            </button>
          </div>

          {/* Editable Code */}
          {currentFile && fileTree[currentFile] && (
            <pre className="flex-grow overflow-auto bg-black text-white p-3">
              <code
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const updated = e.target.innerText
                  const newTree = {
                    ...fileTree,
                    [currentFile]: { file: { contents: updated } },
                  }
                  setFileTree(newTree)
                  saveFileTree(newTree)
                }}
              >
                {fileTree[currentFile]?.file?.contents}
              </code>
            </pre>
          )}
        </div>

        {/* Preview */}
        {iframeUrl && (
          <div className="w-72 border-l border-slate-800 bg-slate-900">
            <iframe src={iframeUrl} className="w-full h-full" title="preview" />
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
              {users.map(u => (
                <div
                  key={u._id}
                  onClick={() => handleUserClick(u._id)}
                  className={`p-2 rounded-md cursor-pointer ${
                    selectedUserId.has(u._id) ? "bg-purple-600" : "bg-slate-800"
                  }`}
                >
                  {u.email}
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
  )
}

export default Project
