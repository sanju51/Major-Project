import { useState, useEffect, useContext } from "react";
import { UserContext } from "../context/user.context";
import axios from "../config/axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

const SortableTask = ({ task, columns, handleUpdateTaskStatus, handleUpdateTaskPriority }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 group hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-indigo-500/10 cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition">{task.title}</h4>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <select
            value={task.status}
            onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
            className="bg-slate-900 text-[9px] rounded-md px-1.5 py-0.5 outline-none opacity-0 group-hover:opacity-100 transition font-bold uppercase tracking-tighter"
          >
            {columns.map(c => (
              <option key={c.status} value={c.status}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>
      
      {task.description && (
        <p className="text-[11px] text-slate-400 mb-4 line-clamp-3 leading-relaxed font-medium">{task.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <select
            value={task.priority}
            onChange={(e) => handleUpdateTaskPriority(task._id, e.target.value)}
            className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-black outline-none border transition-colors ${
              task.priority === "high" || task.priority === "urgent"
                ? "bg-red-500/10 text-red-500 border-red-500/20"
                : task.priority === "medium"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            }`}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {task.assignee ? (
          <div 
            className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-bold shadow-md ring-2 ring-slate-800"
            title={typeof task.assignee === 'object' ? (task.assignee.username || task.assignee.email) : 'User'}
          >
            {typeof task.assignee === 'object' 
              ? (task.assignee.username || task.assignee.email || 'U').charAt(0).toUpperCase()
              : 'U'}
          </div>
        ) : (
          <div className="h-7 w-7 rounded-full bg-slate-700 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500" title="Unassigned">
            <i className="ri-user-add-line text-xs" />
          </div>
        )}
      </div>
    </div>
  );
};

const SortableColumn = ({ column, tasks, columns, handleUpdateTaskStatus, handleUpdateTaskPriority }) => {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  const columnTasks = tasks.filter(t => t.status === column.status);

  return (
    <div ref={setNodeRef} className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 flex flex-col min-h-[500px]">
      <div className="flex justify-between items-center mb-5 px-1">
        <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-500">{column.title}</h3>
        <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
          {columnTasks.length}
        </span>
      </div>
      <SortableContext
        id={column.id}
        items={columnTasks.map(t => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4 flex-grow">
          {columnTasks.map((task) => (
            <SortableTask
              key={task._id}
              task={task}
              columns={columns}
              handleUpdateTaskStatus={handleUpdateTaskStatus}
              handleUpdateTaskPriority={handleUpdateTaskPriority}
            />
          ))}
          {columnTasks.length === 0 && (
            <div className="h-24 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              Empty
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

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
        // Fetch tasks and project details
        const [tasksRes, projectRes] = await Promise.all([
          axios.get(`/tasks/project/${project._id}`),
          axios.get(`/projects/get-project/${project._id}`),
        ]);
        
        setTasks(tasksRes.data.tasks);
        if (projectRes.data.project) {
          setProject(projectRes.data.project);
        }

        // Fetch analytics separately (non-blocking)
        try {
          const analyticsRes = await axios.get(`/analytics/project/${project._id}`);
          setAnalytics(analyticsRes.data);
        } catch (err) {
          console.warn("Could not fetch analytics:", err);
        }
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
      const payload = {
        ...newTask,
        project: project._id,
      };
      
      // Ensure assignee is either a valid ID or removed from payload if empty
      if (!payload.assignee) {
        delete payload.assignee;
      }

      await axios.post("/tasks", payload);
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
      console.error("Failed to create task:", err?.response?.data || err);
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      // Check if dropped over a column or another task
      const overId = over.id;
      
      // Find the column by ID or find the task's status if dropped over a task
      let targetStatus = null;
      
      const column = columns.find(c => c.id === overId);
      if (column) {
        targetStatus = column.status;
      } else {
        const overTask = tasks.find(t => t._id === overId);
        if (overTask) targetStatus = overTask.status;
      }
      
      if (targetStatus) {
        const task = tasks.find(t => t._id === active.id);
        if (task && task.status !== targetStatus) {
          handleUpdateTaskStatus(active.id, targetStatus);
        }
      }
    }
  };

  const userInProject = project?.users?.find(u => (u.user?._id || u.user) === user._id);
  const userRole = userInProject?.role || 'viewer';
  const isAuthorizedToCreate = ['owner', 'admin', 'developer', 'tester'].includes(userRole);

  const columns = [
    { id: "backlog", title: "Backlog", status: "todo" },
    { id: "sprint-ready", title: "Sprint Ready", status: "in-progress" },
    { id: "in-development", title: "In Development", status: "in-review" },
    { id: "testing", title: "Testing & QA", status: "tested" },
    { id: "done", title: "Done", status: "completed" },
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
          {isAuthorizedToCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-indigo-600 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
            >
              + New Task
            </button>
          )}
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

        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
          <i className="ri-kanban-view text-indigo-400" />
          Sprint Planning Board
        </h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-20">
            {columns.map((column) => (
              <SortableColumn
                key={column.id}
                column={column}
                tasks={tasks}
                columns={columns}
                handleUpdateTaskStatus={handleUpdateTaskStatus}
                handleUpdateTaskPriority={handleUpdateTaskPriority}
              />
            ))}
          </div>
        </DndContext>
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
