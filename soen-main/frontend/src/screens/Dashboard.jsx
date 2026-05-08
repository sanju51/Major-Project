import { useState, useEffect, useContext } from "react";
import { UserContext } from "../context/user.context";
import axios from "../config/axios";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

const Dashboard = () => {
  const { user } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get("/analytics/dashboard");
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <div className="text-sm text-slate-400">
            Welcome back, <span className="text-indigo-400">{user?.username || user?.email}</span>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Total Portfolio Value</h3>
            <p className="text-3xl font-bold">${stats?.totalBudget?.toLocaleString() || 0}</p>
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
              <i className="ri-arrow-up-line"></i> 12% vs last month
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Active Initiatives</h3>
            <p className="text-3xl font-bold text-indigo-400">{stats?.activeProjects || 0}</p>
            <div className="mt-2 text-xs text-slate-400">
              Across {stats?.totalProjects || 0} total projects
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Execution Velocity</h3>
            <p className="text-3xl font-bold text-emerald-400">
              {stats?.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </p>
            <div className="mt-2 text-xs text-slate-400">
              {stats?.completedTasks} of {stats?.totalTasks} tasks done
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Capital Utilization</h3>
            <p className="text-3xl font-bold text-pink-400">
              {stats?.totalBudget > 0 ? Math.round((stats.totalSpent / stats.totalBudget) * 100) : 0}%
            </p>
            <div className="mt-2 text-xs text-slate-400">
              ${stats?.totalSpent?.toLocaleString()} spent
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Forecasting Chart */}
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <i className="ri-funds-line text-indigo-400"></i> Revenue & Burn Forecast
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.revenueForecast}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="forecast" stroke="#6366f1" fillOpacity={1} fill="url(#colorForecast)" />
                  <Area type="monotone" dataKey="actual" stroke="#ec4899" fill="#ec4899" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Productivity Heatmap / Team Performance */}
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <i className="ri-team-line text-purple-400"></i> Team Performance (Heatmap)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.productivityHeatmap} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} hide />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={100} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats?.productivityHeatmap?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Custom Report Builder Preview */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Custom Report Builder</h3>
            <button className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/30 hover:bg-indigo-500/30 transition">
              New Report
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Project Health', 'Resource Allocation', 'Monthly Burn'].map((report, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:border-indigo-500/50 transition">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400">
                    <i className="ri-file-chart-line"></i>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{report}</div>
                    <div className="text-[10px] text-slate-500">Last updated 2h ago</div>
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-slate-600 group-hover:text-indigo-400 transition"></i>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
