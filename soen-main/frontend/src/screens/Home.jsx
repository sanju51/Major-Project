import { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {
  const { user } = useContext(UserContext)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
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
      })

      // Try to get created project from response; fall back to re-fetch if needed
      const created = res.data?.project || null

      if (created) {
        setProjects(prev => [created, ...prev])
      }

      setProjectName('')
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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold">
              Welcome{user?.username ? `, ${user.username}` : user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-lg">
              Create and collaborate on AI-powered projects in a sleek workspace.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-2.5 text-sm font-medium shadow-lg shadow-purple-500/40 transition hover:scale-105 hover:shadow-purple-500/60"
          >
            <span className="relative z-10 flex items-center gap-2">
              <i className="ri-add-line text-lg" />
              New Project
            </span>
            <span className="pointer-events-none absolute inset-0 rounded-full bg-white/10 opacity-0 blur-xl transition group-hover:opacity-100" />
          </button>
        </header>

        {/* Projects grid */}
        <section className="mt-8">
          {projects.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-white/5 px-6 py-16 text-center backdrop-blur-xl">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/40">
                <i className="ri-folder-add-line text-2xl text-white" />
              </div>
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="mt-1 text-sm text-slate-400 max-w-md">
                Start by creating your first project. You can add collaborators and chat with AI inside each project.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-purple-400/60 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-100 hover:bg-purple-500/20 transition"
              >
                <i className="ri-sparkling-line" />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid gap-5 mt-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* New project card */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300 backdrop-blur-md transition hover:border-purple-400/80 hover:bg-slate-900 hover:shadow-lg hover:shadow-purple-500/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-md shadow-purple-500/40">
                  <i className="ri-add-line text-xl text-white" />
                </div>
                <span className="font-medium">New Project</span>
                <span className="text-xs text-slate-400">
                  Click to create a fresh workspace
                </span>
              </button>

              {/* Existing projects */}
              {projects.map((project) => (
                <div
                  key={project._id}
                  onClick={() => {
                    navigate(`/project`, { state: { project } })
                  }}
                  className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur-md transition hover:-translate-y-1 hover:border-purple-400/80 hover:bg-slate-900 hover:shadow-xl hover:shadow-purple-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-lg">
                        <i className="ri-folder-3-line" />
                      </div>
                      <h2 className="text-base font-semibold truncate max-w-[11rem]">
                        {project.name}
                      </h2>
                    </div>
                    <i className="ri-arrow-right-up-line text-slate-500 group-hover:text-purple-300 transition" />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <i className="ri-user-line text-slate-500" />
                      <span>{project.users?.length || 0} collaborators</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.owner && (
                        <span className="rounded-full bg-indigo-600/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200">
                          Owner: {project.owner.username || (project.owner.email ? project.owner.email.split('@')[0] : '')}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                        Active
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-purple-500/40">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-800/80 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
            >
              <i className="ri-close-line text-lg" />
            </button>

            <h2 className="text-xl font-semibold mb-1">Create a new project</h2>
            <p className="text-xs text-slate-400 mb-5">
              Give your project a short, descriptive name. You can add collaborators later.
            </p>

            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Project Name
                </label>
                <div className="relative">
                  <input
                    onChange={(e) => setProjectName(e.target.value)}
                    value={projectName}
                    type="text"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="ex: AI Marketing Assistant"
                    required
                  />
                  <i className="ri-edit-2-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
                  {String(error)}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:shadow-purple-500/60 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="ri-rocket-2-line text-sm" />
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
