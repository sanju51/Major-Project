import { useState, useEffect, useContext } from "react";
import { UserContext } from "../context/user.context";
import axios from "../config/axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

const ProjectDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [project, setProject] = useState(location.state?.project);
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Task creation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "todo",
    assignee: "",
  });

  const fetchData = async () => {
    try {
      if (project?._id) {
        const [tasksRes, analyticsRes] = await Promise.all([
          axios.get(`/tasks/project/${project._id}`),
          axios.get(`/analytics/project/${project._id}`),
        ]);
        setTasks(tasksRes.data.tasks);
        setAnalytics(analyticsRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch project data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [project]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/tasks", {
        ...newTask,
        project: project._id,
      });
      setIsModalOpen(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        assignee: "",
      });
      fetchData();
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`/tasks/${taskId}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  const handleUpdateTaskPriority = async (taskId, newPriority) => {
    try {
      await axios.put(`/tasks/${taskId}`, { priority: newPriority });
      fetchData();
    } catch (err) {
      console.error("Failed to update task priority:", err);
    }
  };

  const columns = [
    { id: "todo", title: "To Do", status: "todo" },
    { id: "in-progress", title: "In Progress", status: "in-progress" },
    { id: "in-review", title: "In Review", status: "in-review" },
    { id: "tested", title: "Tested", status: "tested" },
    { id: "completed", title: "Completed", status: "completed" },
  ];

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"
            >
              <i className="ri-arrow-left-line" />
            </button>
            <h1 className="text-3xl font-bold">{project?.name}</h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-indigo-600 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
          >
            + New Task
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg">
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Completion</h3>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-emerald-400">{analytics?.projectCompletion || 0}%</p>
              <div className="w-24 bg-slate-800 rounded-full h-2 mb-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${analytics?.projectCompletion || 0}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg">
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Bandwidth Load</h3>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-indigo-400">{analytics?.bandwidth?.load || 0}%</p>
              <div className="w-24 bg-slate-800 rounded-full h-2 mb-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${analytics?.bandwidth?.load || 0}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg">
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Total Tasks</h3>
            <p className="text-3xl font-bold">{analytics?.totalTasks || 0}</p>
          </div>
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg">
            <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Current Burn</h3>
            <p className="text-3xl font-bold text-amber-400">${analytics?.spent?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Burn-down Chart */}
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <i className="ri-fire-line text-orange-400"></i> Burn-down Chart
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.burnDownData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="remaining" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 italic text-center">Remaining tasks over the last 7 days</p>
          </div>

          {/* Velocity Chart */}
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <i className="ri-speed-up-line text-emerald-400"></i> Sprint Velocity
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.velocityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="sprint" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 italic text-center">Completed tasks across recent sprints</p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Kanban Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {columns.map((column) => (
            <div key={column.id} className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold mb-4">{column.title}</h3>
              <div className="space-y-3">
                {tasks
                  .filter((task) => task.status === column.status)
                  .map((task) => (
                    <div
                      key={task._id}
                      className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 group hover:border-indigo-500/50 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm">{task.title}</h4>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                          className="bg-slate-800 text-[10px] rounded px-1 py-0.5 outline-none opacity-0 group-hover:opacity-100 transition"
                        >
                          {columns.map(c => (
                            <option key={c.status} value={c.status}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                      
                      {task.description && (
                        <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-tight">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-2">
                          <select
                            value={task.priority}
                            onChange={(e) => handleUpdateTaskPriority(task._id, e.target.value)}
                            className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold outline-none ${
                              task.priority === "high" || task.priority === "urgent"
                                ? "bg-red-500/20 text-red-400"
                                : task.priority === "medium"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>

                        {task.assignee && (
                          <div 
                            className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold shadow-sm"
                            title={task.assignee.username || task.assignee.email}
                          >
                            {(task.assignee.username || task.assignee.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6 text-indigo-400">Create New Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Title</label>
                <input
                  required
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                  placeholder="e.g. Implement Auth Flow"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none h-24 resize-none"
                  placeholder="Briefly describe the task..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Assignee</label>
                  <select
                    value={newTask.assignee}
                    onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">Unassigned</option>
                    {project?.users?.map((u) => (
                      <option key={u.user._id} value={u.user._id}>
                        {u.user.username || u.user.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 rounded-xl text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
