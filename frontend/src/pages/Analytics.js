import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Home,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  UserPlus,
  Activity,
  Download,
  Filter,
  ArrowLeft,
  Loader2
} from 'lucide-react';

const Analytics = () => {
  const navigate = useNavigate();
  const { api, logout, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [consultants, setConsultants] = useState([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedConsultant, setSelectedConsultant] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, consultantsRes] = await Promise.all([
        api().get('/reports/summary', { params: { start_date: startDate, end_date: endDate } }),
        api().get('/reports/consultants')
      ]);
      setData(summaryRes.data);
      setConsultants(consultantsRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Prepare chart data
  const dailyData = data?.daily_stats 
    ? Object.entries(data.daily_stats)
        .map(([date, count]) => ({ date: date.slice(5), count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const consultantData = data?.consultant_stats
    ? Object.entries(data.consultant_stats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Heatmap data
  const heatmapData = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour < 20; hour++) {
      const key = `${day}-${hour}`;
      heatmapData.push({
        day: days[day],
        hour: `${hour}:00`,
        count: data?.hourly_stats?.[key] || 0
      });
    }
  }

  const maxHeatValue = Math.max(...heatmapData.map(d => d.count), 1);

  const getHeatColor = (count) => {
    if (count === 0) return 'bg-slate-800';
    const intensity = count / maxHeatValue;
    if (intensity < 0.25) return 'bg-violet-900/30';
    if (intensity < 0.5) return 'bg-violet-700/50';
    if (intensity < 0.75) return 'bg-violet-600/70';
    return 'bg-violet-500';
  };

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div data-testid="analytics-view" className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              data-testid="analytics-back-btn"
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">
                <span className="text-violet-500">Clinic</span> Analytics
              </h1>
              <p className="text-xs text-slate-500">Business Intelligence Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              Logged in as <span className="text-white font-medium">{user?.username}</span>
            </span>
            <Button variant="ghost" onClick={logout} className="text-red-400 hover:text-red-300">
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div data-testid="report-controls" className="container mx-auto px-4 py-6">
        <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs text-slate-400 uppercase">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border-slate-800 w-40 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400 uppercase">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border-slate-800 w-40 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400 uppercase">Consultant</Label>
            <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
              <SelectTrigger className="bg-slate-950 border-slate-800 w-40 mt-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Consultants</SelectItem>
                {consultants.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadData} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Filter className="w-4 h-4 mr-2" />}
            Apply Filters
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="container mx-auto px-4 pb-12">
          {/* KPI Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div data-testid="kpi-total-visits" className="glass-panel p-6 rounded-xl border-l-4 border-violet-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Total Visits</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{data?.total_visits || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-violet-500 opacity-50" />
              </div>
            </div>

            <div data-testid="kpi-unique-patients" className="glass-panel p-6 rounded-xl border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Unique Patients</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{data?.unique_patients || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </div>

            <div data-testid="kpi-new-patients" className="glass-panel p-6 rounded-xl border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">New Patients</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{data?.new_patients || 0}</p>
                </div>
                <UserPlus className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </div>

            <div data-testid="kpi-avg-daily" className="glass-panel p-6 rounded-xl border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Avg/Day</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{data?.avg_visits_per_day || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Visits Chart */}
            <div className="glass-panel p-6 rounded-xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Daily Visits
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Consultant Performance */}
            <div className="glass-panel p-6 rounded-xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Consultant Performance
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consultantData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={80} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Visit Heatmap (Day & Hour)
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hours header */}
                <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '60px repeat(12, 1fr)' }}>
                  <div></div>
                  {[8,9,10,11,12,13,14,15,16,17,18,19].map(h => (
                    <div key={h} className="text-[10px] text-slate-500 text-center font-mono">{h}:00</div>
                  ))}
                </div>
                
                {/* Rows */}
                {days.map((day, dayIndex) => (
                  <div key={day} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(12, 1fr)' }}>
                    <div className="text-xs text-slate-400 font-medium flex items-center">{day}</div>
                    {[8,9,10,11,12,13,14,15,16,17,18,19].map(hour => {
                      const cellData = heatmapData.find(d => d.day === day && d.hour === `${hour}:00`);
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={`h-8 rounded flex items-center justify-center text-[10px] text-transparent hover:text-white transition-all cursor-default ${getHeatColor(cellData?.count || 0)}`}
                          title={`${day} ${hour}:00 - ${cellData?.count || 0} visits`}
                        >
                          {cellData?.count || 0}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
              <span>Less</span>
              <div className="w-4 h-4 rounded bg-slate-800"></div>
              <div className="w-4 h-4 rounded bg-violet-900/30"></div>
              <div className="w-4 h-4 rounded bg-violet-700/50"></div>
              <div className="w-4 h-4 rounded bg-violet-600/70"></div>
              <div className="w-4 h-4 rounded bg-violet-500"></div>
              <span>More</span>
            </div>
          </div>

          {/* Pie Chart */}
          {consultantData.length > 0 && (
            <div className="glass-panel p-6 rounded-xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Visit Distribution by Consultant</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consultantData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {consultantData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 p-4 text-center text-xs text-slate-600">
        System by{' '}
        <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500 hover:underline">
          Kamil Dyczkowski
        </a>{' '}
        2026
      </footer>
    </div>
  );
};

export default Analytics;
