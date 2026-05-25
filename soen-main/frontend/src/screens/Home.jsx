import { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import { useTheme } from '../context/theme.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {
  const { user } = useContext(UserContext)
  const { theme, toggleTheme } = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectPriority, setProjectPriority] = useState('medium')
  const [projectType, setProjectType] = useState('web-app')
  const [projectCategory, setProjectCategory] = useState('Software Development')
  const [projectStatus, setProjectStatus] = useState('planned')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('scratch')
  const [projectFiles, setProjectFiles] = useState(null)
  const [projects, setProjects] = useState([])

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function createProject(e) {
    e.preventDefault()
    if (!projectName.trim()) return
    setError('')
    setCreating(true)

    try {
      const res = await axios.post('/projects/create', {
        name: projectName.trim(),
        description: projectDescription.trim(),
        priority: projectPriority,
        projectType: projectType,
        category: projectCategory,
        status: projectStatus,
        startDate: startDate,
        endDate: endDate,
        template: selectedTemplate
      })

      const created = res.data?.project || null

      if (created && projectFiles) {
        // If there are files, upload them
        const formData = new FormData()
        formData.append('file', projectFiles)
        formData.append('projectId', created._id)
        formData.append('title', `Initial file for ${created.name}`)

        await axios.post('/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        // 🤖 NEW: AI Task Division from document
        try {
          let documentText = `Document Name: ${projectFiles.name}.`;
          
          // Try to read file content if it's a text file
          if (projectFiles.type.startsWith('text/') || projectFiles.name.endsWith('.md') || projectFiles.name.endsWith('.json')) {
            const reader = new FileReader();
            const content = await new Promise((resolve) => {
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsText(projectFiles);
            });
            documentText += `\n\nContent:\n${content}`;
          }

          const aiRes = await axios.post('/ai/divide-tasks', {
            documentContent: documentText,
            projectContext: {
              name: projectName,
              description: projectDescription,
              category: projectCategory,
              priority: projectPriority
            }
          });

          if (aiRes.data.tasks && aiRes.data.tasks.length > 0) {
            // Auto-create tasks divided by AI
            await Promise.all(aiRes.data.tasks.map(task => 
              axios.post('/tasks', {
                ...task,
                project: created._id
              })
            ));
          }
        } catch (aiErr) {
          console.error("AI Task Division failed:", aiErr);
        }
      }

      if (created) {
        setProjects(prev => [created, ...prev])
      }

      setProjectName('')
      setProjectDescription('')
      setProjectPriority('medium')
      setProjectType('web-app')
      setProjectCategory('Software Development')
      setProjectStatus('planned')
      setStartDate('')
      setEndDate('')
      setSelectedTemplate('scratch')
      setProjectFiles(null)
      setIsModalOpen(false)
    } catch (err) {
      console.log(err)
      setError(
        err?.response?.data?.errors ||
        err?.response?.data ||
        'Something went wrong while creating project'
      )
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    axios
      .get('/projects/all')
      .then((res) => {
        setProjects(res.data.projects || [])
      })
      .catch(err => {
        console.log(err)
      })
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-indigo-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">
              Welcome{user?.username ? `, ${user.username}` : user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-lg">
              Create and collaborate on AI-powered projects in a sleek workspace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <i className={theme === 'dark' ? 'ri-sun-line text-lg' : 'ri-moon-line text-lg'} />
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="relative p-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition shadow-sm"
              title="View Profile"
            >
              <i className="ri-user-line text-lg" />
            </button>

            <div className="relative group">
              <button className="flex items-center gap-2 p-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition shadow-sm">
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  {(user?.username || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <i className="ri-arrow-down-s-line text-sm" />
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-900/20 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
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
              onClick={() => setIsModalOpen(true)}
              className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/40 transition hover:scale-105 hover:shadow-purple-500/60"
            >
              <span className="relative z-10 flex items-center gap-2">
                <i className="ri-add-line text-lg" />
                New Project
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-full bg-white/10 opacity-0 blur-xl transition group-hover:opacity-100" />
            </button>
          </div>
        </header>

        {/* Projects grid */}
        <section className="mt-8">
          {projects.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-white/5 px-6 py-16 text-center backdrop-blur-xl shadow-sm">
              <div className="mb-4 flex h-16 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/40">
                <i className="ri-folder-add-line text-3xl text-white" />
              </div>
              <h2 className="text-xl font-bold">No projects yet</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Start by creating your first project. You can add collaborators and chat with AI inside each project.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-purple-400/60 bg-purple-500/10 px-6 py-3 text-sm font-bold text-purple-600 dark:text-purple-100 hover:bg-purple-500/20 transition"
              >
                <i className="ri-sparkling-line" />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid gap-6 mt-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* New project card */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-6 text-sm text-slate-500 dark:text-slate-300 backdrop-blur-md transition hover:border-purple-400/80 hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-xl shadow-sm"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-md shadow-purple-500/40 group-hover:scale-110 transition duration-300">
                  <i className="ri-add-line text-2xl text-white" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-base block">New Project</span>
                  <span className="text-xs text-slate-400 mt-1">
                    Click to create a fresh workspace
                  </span>
                </div>
              </button>

              {/* Existing projects */}
              {projects.map((project) => (
                <div
                  key={project._id}
                  onClick={() => {
                    navigate(`/project`, { state: { project } })
                  }}
                  className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 backdrop-blur-md transition hover:-translate-y-1 hover:border-purple-400/80 hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-2xl shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-xl shadow-md">
                        <i className="ri-folder-3-line" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold truncate max-w-[11rem]">
                          {project.name}
                        </h2>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                          {project.category || 'Software Development'}
                        </p>
                      </div>
                    </div>
                    <i className="ri-arrow-right-up-line text-slate-300 dark:text-slate-500 group-hover:text-purple-500 transition text-lg" />
                  </div>

                  {project.description && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-8">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 font-medium">
                      <i className="ri-group-line text-indigo-500" />
                      <span>{project.users?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-bold ${
                        project.priority === 'urgent' ? 'bg-red-500/10 text-red-500' :
                        project.priority === 'high' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {project.priority || 'Medium'}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-600 font-bold">
                        {project.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create project modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-6 top-6 rounded-full bg-slate-100 dark:bg-slate-800 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
            >
              <i className="ri-close-line text-xl" />
            </button>

            <h2 className="text-3xl font-extrabold mb-2 text-indigo-600 dark:text-indigo-400">Create New Project</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
              Define your project goals, timeline, and team.
            </p>

            <form onSubmit={createProject} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Project Name
                    </label>
                    <input
                      onChange={(e) => setProjectName(e.target.value)}
                      value={projectName}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                      placeholder="e.g. AI Platform V2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Category
                    </label>
                    <select
                      value={projectCategory}
                      onChange={(e) => setProjectCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition appearance-none"
                    >
                      <option value="Software Development">Software Development</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Business">Business</option>
                      <option value="Design">Design</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Priority
                      </label>
                      <select
                        value={projectPriority}
                        onChange={(e) => setProjectPriority(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Status
                      </label>
                      <select
                        value={projectStatus}
                        onChange={(e) => setProjectStatus(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                      >
                        <option value="planned">Planned</option>
                        <option value="active">Active</option>
                        <option value="on-hold">On Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Description
                    </label>
                    <textarea
                      onChange={(e) => setProjectDescription(e.target.value)}
                      value={projectDescription}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition min-h-[160px] resize-none"
                      placeholder="Describe the project scope and objectives..."
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Requirements Document (AI Analysis)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={(e) => setProjectFiles(e.target.files[0])}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-500/10 file:text-indigo-600 dark:file:text-indigo-400 hover:file:bg-indigo-500/20 transition"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 italic font-medium">
                    Upload a .txt or .md file to automatically generate tasks using AI.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Start Date
                  </label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    End Date
                  </label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm focus:border-indigo-500 dark:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                  Choose a Template
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'scratch', name: 'Start from Scratch', desc: 'Empty project with no predefined tasks.', tag: 'FLEXIBLE' },
                    { id: 'agile', name: 'Agile Development', desc: 'Sprints, backlog, and bug tracking setup.', tag: 'RECURRING' },
                    { id: 'website', name: 'Website Redesign', desc: 'Wireframing, design, and dev phases.', tag: '8 WEEKS' },
                    { id: 'marketing', name: 'Marketing Campaign', desc: 'Content calendar and social media plan.', tag: '6 WEEKS' },
                  ].map((tpl) => (
                    <div 
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 ${
                        selectedTemplate === tpl.id 
                        ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' 
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-xs font-bold leading-tight pr-4">{tpl.name}</h4>
                        {selectedTemplate === tpl.id && <i className="ri-checkbox-circle-fill text-indigo-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-tight">{tpl.desc}</p>
                      <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase tracking-tighter">
                        {tpl.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3 font-medium">
                  {String(error)}
                </p>
              )}

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 hover:shadow-indigo-500/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <i className="ri-rocket-2-line text-lg" />
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Home
