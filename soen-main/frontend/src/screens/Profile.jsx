import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/user.context';
import { useTheme } from '../context/theme.context';
import axios from '../config/axios';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, setUser } = useContext(UserContext);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    skills: user?.skills?.join(', ') || '',
    linkedin: user?.linkedin || '',
    github: user?.github || '',
    portfolioUrl: user?.portfolioUrl || '',
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
      };
      const res = await axios.put('/users/profile', payload);
      setUser(res.data);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-20">
      {/* Cover Image */}
      <div className="h-48 md:h-64 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />

      <div className="max-w-4xl mx-auto px-4">
        {/* Profile Header Card */}
        <div className="-mt-20 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 relative">
          <button 
            onClick={() => navigate('/')}
            className="absolute left-6 top-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition"
          >
            <i className="ri-arrow-left-line text-xl" />
          </button>

          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="relative">
              <div className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white dark:border-slate-900 bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg overflow-hidden">
                {user?.avatar ? <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" /> : (user?.username || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <button className="absolute bottom-2 right-2 p-2 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition">
                <i className="ri-camera-line" />
              </button>
            </div>

            <div className="flex-grow">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-extrabold">{user?.username || "Professional User"}</h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{user?.email}</p>
                </div>
                {!editing && (
                  <button 
                    onClick={() => setEditing(true)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
                {user?.linkedin && (
                  <a href={user.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline">
                    <i className="ri-linkedin-box-fill text-lg" /> LinkedIn
                  </a>
                )}
                {user?.github && (
                  <a href={user.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:underline">
                    <i className="ri-github-fill text-lg" /> GitHub
                  </a>
                )}
                {user?.portfolioUrl && (
                  <a href={user.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline">
                    <i className="ri-global-line text-lg" /> Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: About & Skills */}
          <div className="md:col-span-2 space-y-8">
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <i className="ri-user-4-line text-indigo-500" />
                About Me
              </h2>
              {editing ? (
                <textarea 
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                  placeholder="Tell us about your professional background..."
                />
              ) : (
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {user?.bio || "No bio added yet. Click 'Edit Profile' to share your story."}
                </p>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <i className="ri-rocket-line text-purple-500" />
                Experience
              </h2>
              <div className="space-y-6">
                {(user?.experience?.length > 0 ? user.experience : [
                  { company: "ProjectPulse Inc.", position: "Senior Collaborator", duration: "Jan 2024 - Present", description: "Leading distributed teams and AI-driven workflows." }
                ]).map((exp, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="mt-1 h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition">
                      <i className="ri-building-line text-slate-400 group-hover:text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">{exp.position}</h4>
                      <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">{exp.company}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">{exp.duration}</p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{exp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Skills & Contact */}
          <div className="space-y-8">
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <i className="ri-tools-line text-emerald-500" />
                Skills
              </h2>
              {editing ? (
                <input 
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  placeholder="React, Node.js, AI (comma separated)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(user?.skills?.length > 0 ? user.skills : ['JavaScript', 'React', 'Node.js', 'System Design']).map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {editing && (
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold mb-2">Social Links</h2>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">LinkedIn</label>
                  <input 
                    type="text" 
                    value={formData.linkedin}
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">GitHub</label>
                  <input 
                    type="text" 
                    value={formData.github}
                    onChange={(e) => setFormData({...formData, github: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="pt-4 flex gap-2">
                  <button 
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex-grow py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button 
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-sm font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Profile;
