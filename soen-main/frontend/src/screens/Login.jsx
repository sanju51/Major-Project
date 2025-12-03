// frontend/src/screens/Login.jsx
import { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { setUser } = useContext(UserContext)
  const navigate = useNavigate()

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  async function submitHandler(e) {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Please enter a valid email')
      return
    }

    if (!password) {
      setError('Please enter your password')
      return
    }

    try {
      setLoading(true)
      const res = await axios.post('/users/login', { email, password })

      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
      if (res.data?.user?.username) {
        navigate('/')
      } else {
        navigate('/onboarding')
      }
    } catch (err) {
      console.log(err?.response?.data || err)
      setError(
        err?.response?.data?.errors ||
          err?.response?.data ||
          'Login failed'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      {/* Glow background blob */}
      <div className="pointer-events-none fixed inset-0 opacity-40 blur-3xl">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-purple-500/40" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-indigo-500/40" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/60">
            <i className="ri-planet-line text-xl text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-semibold leading-tight">Welcome to Syntara</h1>
            <p className="text-xs text-slate-400">Sign in to continue.</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 px-6 py-6 shadow-2xl shadow-slate-950/80 backdrop-blur-xl">
          <form onSubmit={submitHandler} className="space-y-4">
            {/* Email */}
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400"
                htmlFor="email"
              >
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  placeholder="you@example.com"
                />
                <i className="ri-at-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  placeholder="Enter your password"
                />
                <i className="ri-lock-2-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500/40"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-[11px] text-purple-300 hover:text-purple-200"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
                {String(error)}
              </p>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:shadow-purple-500/60 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                  Logging in…
                </>
              ) : (
                <>
                  <i className="ri-login-circle-line text-lg" />
                  Login
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-purple-300 hover:text-purple-200 font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
