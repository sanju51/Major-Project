// frontend/src/screens/Register.jsx
import { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'

const Register = () => {
  const [step, setStep] = useState('form') // 'form' or 'otp'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { setUser } = useContext(UserContext)
  const navigate = useNavigate()

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (step === 'form') {
      // STEP 1: send OTP to email
      if (!validateEmail(email)) {
        setError('Please enter a valid email')
        return
      }

      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }

      try {
        setLoading(true)
        await axios.post('/users/register-start', { email, password })
        setStep('otp') // show OTP field
      } catch (err) {
        console.log(err?.response?.data || err)
        setError(
          err?.response?.data?.errors ||
            err?.response?.data ||
            'Failed to send OTP'
        )
      } finally {
        setLoading(false)
      }
    } else {
      // STEP 2: verify OTP and finish registration
      if (!/^[0-9]{4,6}$/.test(otp)) {
        setError('Please enter a valid OTP')
        return
      }

      try {
        setLoading(true)
        const res = await axios.post('/users/register-verify', {
          email,
          otp,
        })

        localStorage.setItem('token', res.data.token)
        setUser(res.data.user)
        navigate('/') // go to home
      } catch (err) {
        console.log(err?.response?.data || err)
        setError(
          err?.response?.data?.errors ||
            err?.response?.data ||
            'OTP verification failed'
        )
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed inset-0 opacity-40 blur-3xl">
        <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-purple-500/40" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-pink-500/40" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header / brand */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/60">
            <i className="ri-user-add-line text-xl text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-semibold leading-tight">
              {step === 'form' ? 'Create your account' : 'Verify your email'}
            </h1>
            <p className="text-xs text-slate-400">
              {step === 'form'
                ? 'Sign up to start creating collaborative AI projects.'
                : `We’ve sent an OTP to ${email}. Enter it to finish.`}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-4 flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'form'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              1
            </div>
            <span>Account</span>
          </div>
          <div className="h-px w-6 bg-slate-700" />
          <div className="flex items-center gap-1">
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'otp'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              2
            </div>
            <span>Verify</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 px-6 py-6 shadow-2xl shadow-slate-950/80 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 'form' && (
              <>
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
                      placeholder="Create a strong password"
                    />
                    <i className="ri-lock-password-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Minimum 6 characters. Use letters and numbers.
                  </p>
                </div>
              </>
            )}

            {step === 'otp' && (
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400"
                  htmlFor="otp"
                >
                  One-time password
                </label>
                <div className="relative">
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 tracking-[0.3em]"
                    placeholder="123456"
                  />
                  <i className="ri-shield-keyhole-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Enter the 4–6 digit code we emailed you. Check spam/promotions if you don&apos;t see it.
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
                {String(error)}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:shadow-purple-500/60 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                  Please wait…
                </>
              ) : step === 'form' ? (
                <>
                  <i className="ri-mail-check-line text-lg" />
                  Register &amp; Send OTP
                </>
              ) : (
                <>
                  <i className="ri-shield-check-line text-lg" />
                  Verify &amp; Finish
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-purple-300 hover:text-purple-200 font-medium"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
