import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'

const Onboarding = () => {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, user } = useContext(UserContext)
  const navigate = useNavigate()

  async function submitHandler(e) {
    e.preventDefault()
    setError('')

    const trimmed = username.trim()
    if (trimmed.length < 2 || trimmed.length > 30) {
      setError('Username must be 2–30 characters long')
      return
    }

    try {
      setLoading(true)
      const res = await axios.post('/users/set-username', { username: trimmed })
      setUser(res.data.user)
      navigate('/')
    } catch (err) {
      console.log(err?.response?.data || err)
      setError(
        err?.response?.data?.errors || err?.response?.data || 'Failed to set username'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/60">
            <i className="ri-user-smile-line text-xl text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-semibold leading-tight">Hello developer</h1>
            <p className="text-xs text-slate-400">What should we call you?</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 px-6 py-6 shadow-2xl shadow-slate-950/80 backdrop-blur-xl">
          <form onSubmit={submitHandler} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  placeholder="e.g. Sanjana"
                />
                <i className="ri-edit-2-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">2–30 characters, letters and numbers.</p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">{String(error)}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:shadow-purple-500/60 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="ri-check-line text-lg" />
                  Continue
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
