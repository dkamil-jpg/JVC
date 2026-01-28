import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  Home, Calendar, Users, TrendingUp, Clock, UserPlus, Activity,
  Download, Filter, ArrowLeft, Loader2, AlertTriangle, MapPin,
  Briefcase, FileWarning, UserX, CheckCircle, XCircle
} from 'lucide-react';

const Analytics = () => {
  const navigate = useNavigate();
  const { api, logout, user } = useAuth();
  const printRef = useRef();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api().get('/reports/comprehensive', { params: { start_date: startDate, end_date: endDate } });
      setData(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [startDate, endDate]);

  // Prepare chart data
  const dailyData = data?.visit_trends?.daily_stats 
    ? Object.entries(data.visit_trends.daily_stats).map(([date, count]) => ({ date: date.slice(5), fullDate: date, count }))
    : [];

  const consultantData = data?.consultant_workload?.consultants || [];
  const treatmentData = data?.treatment_mix?.treatments?.slice(0, 10) || [];
  const cityData = data?.geographic?.cities?.slice(0, 10) || [];

  // Heatmap data
  const heatmapData = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour < 20; hour++) {
      const key = `${day}-${hour}`;
      heatmapData.push({ day: days[day], hour: `${hour}:00`, count: data?.hourly_heatmap?.[key] || 0 });
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

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  // Export comprehensive PDF report
  const handleExportReport = () => {
    const vt = data?.visit_trends || {};
    const cw = data?.consultant_workload || {};
    const tm = data?.treatment_mix || {};
    const nvr = data?.new_vs_returning || {};
    const qa = data?.queue_analytics || {};
    const aa = data?.alerts_analytics || {};
    const geo = data?.geographic || {};
    const dq = data?.data_quality || {};
    const ip = data?.inactive_patients || {};

    const consultantRows = (cw.consultants || []).map(c => `<tr><td>${c.name}</td><td>${c.count}</td><td>${c.percentage}%</td></tr>`).join('');
    const treatmentRows = (tm.treatments || []).slice(0, 15).map(t => `<tr><td>${t.name}</td><td>${t.count}</td><td>${t.percentage}%</td></tr>`).join('');
    const cityRows = (geo.cities || []).slice(0, 10).map(c => `<tr><td>${c.city}</td><td>${c.patient_count}</td><td>${c.visit_count}</td><td>${c.percentage}%</td></tr>`).join('');
    const alertRows = (aa.top_alerts || []).slice(0, 10).map(a => `<tr><td>${a.alert}</td><td>${a.count}</td></tr>`).join('');
    const inactive60Rows = (ip.over_60_days || []).slice(0, 10).map(p => `<tr><td>${p.name}</td><td>${p.phone}</td><td>${p.last_visit}</td><td>${p.days_since}</td></tr>`).join('');
    const inactive90Rows = (ip.over_90_days || []).slice(0, 10).map(p => `<tr><td>${p.name}</td><td>${p.phone}</td><td>${p.last_visit}</td><td>${p.days_since}</td></tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><title>Clinic Analytics Report</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; font-size: 11px; }
  h1 { color: #7c3aed; border-bottom: 3px solid #7c3aed; padding-bottom: 10px; font-size: 24px; }
  h2 { margin-top: 30px; font-size: 14px; color: #333; background: #f3f4f6; padding: 8px; border-left: 4px solid #7c3aed; }
  h3 { font-size: 12px; color: #666; margin-top: 20px; }
  .period { color: #666; margin-bottom: 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
  .kpi { padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
  .kpi-value { font-size: 28px; font-weight: bold; color: #111; }
  .kpi-label { font-size: 10px; color: #666; text-transform: uppercase; margin-top: 5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
  th { background: #e5e7eb; padding: 8px; text-align: left; font-weight: bold; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .alert { color: #dc2626; }
  .success { color: #16a34a; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 9px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
  <h1>Just Vitality Clinic - Analytics Report</h1>
  <p class="period"><strong>Period:</strong> ${startDate} to ${endDate} (${data?.period?.days || 0} days)</p>
  
  <h2>📊 Key Performance Indicators</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${vt.total_visits || 0}</div><div class="kpi-label">Total Visits</div></div>
    <div class="kpi"><div class="kpi-value">${nvr.unique_patients || 0}</div><div class="kpi-label">Unique Patients</div></div>
    <div class="kpi"><div class="kpi-value">${nvr.new_registrations || 0}</div><div class="kpi-label">New Registrations</div></div>
    <div class="kpi"><div class="kpi-value">${vt.avg_daily || 0}</div><div class="kpi-label">Avg Visits/Day</div></div>
  </div>

  <h2>📈 Visit Trends</h2>
  <div class="two-col">
    <div><h3>Peak Performance</h3>
      <p>🏆 <strong>Best Day:</strong> ${vt.peak_day?.date || 'N/A'} (${vt.peak_day?.count || 0} visits)</p>
      <p>📉 <strong>Worst Day:</strong> ${vt.worst_day?.date || 'N/A'} (${vt.worst_day?.count || 0} visits)</p>
    </div>
    <div><h3>Patient Retention</h3>
      <p>🆕 <strong>First-time Visits:</strong> ${nvr.new_patient_visits || 0}</p>
      <p>🔄 <strong>Returning Visits:</strong> ${nvr.returning_visits || 0}</p>
      <p>📊 <strong>Repeat Rate:</strong> ${nvr.repeat_rate || 0}% (patients with 2+ visits)</p>
    </div>
  </div>

  <h2>👥 Consultant Workload</h2>
  <p>Top performer: <strong>${cw.top_consultant?.name || 'N/A'}</strong> (${cw.top_consultant?.count || 0} visits)</p>
  <table><thead><tr><th>Consultant</th><th>Visits</th><th>Share</th></tr></thead><tbody>${consultantRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>

  <h2>💉 Treatment Mix (Top 15)</h2>
  <table><thead><tr><th>Treatment</th><th>Count</th><th>Share</th></tr></thead><tbody>${treatmentRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>

  <h2>📍 Geographic Distribution</h2>
  <table><thead><tr><th>City</th><th>Patients</th><th>Visits</th><th>Share</th></tr></thead><tbody>${cityRows || '<tr><td colspan="4">No data</td></tr>'}</tbody></table>

  <h2>🚨 Alerts Analysis</h2>
  <p>Check-ins with alerts: <strong class="alert">${aa.checkins_with_alerts || 0}</strong> (${aa.alert_rate || 0}% of all check-ins)</p>
  <table><thead><tr><th>Alert Type</th><th>Count</th></tr></thead><tbody>${alertRows || '<tr><td colspan="2">No alerts</td></tr>'}</tbody></table>

  <h2>📋 Queue Analytics</h2>
  <p>Total check-ins: <strong>${qa.total_checkins || 0}</strong> | Completed: <strong class="success">${qa.total_completed || 0}</strong> | Completion Rate: <strong>${qa.completion_rate || 0}%</strong></p>
  <p>Average check-ins per day: <strong>${qa.avg_checkins_per_day || 0}</strong></p>

  <h2>⚠️ Inactive Patients - Follow-up Needed</h2>
  <h3>Over 60 Days (${ip.count_60 || 0} patients)</h3>
  <table><thead><tr><th>Name</th><th>Phone</th><th>Last Visit</th><th>Days</th></tr></thead><tbody>${inactive60Rows || '<tr><td colspan="4">None</td></tr>'}</tbody></table>
  <h3>Over 90 Days (${ip.count_90 || 0} patients)</h3>
  <table><thead><tr><th>Name</th><th>Phone</th><th>Last Visit</th><th>Days</th></tr></thead><tbody>${inactive90Rows || '<tr><td colspan="4">None</td></tr>'}</tbody></table>

  <h2>📊 Data Quality Score</h2>
  <p>Average completeness: <strong>${dq.avg_completeness_score || 0}%</strong></p>
  <div class="two-col">
    <div><h3>Missing Data</h3>
      <p>❌ Email: ${dq.missing?.email || 0}</p>
      <p>❌ Phone: ${dq.missing?.phone || 0}</p>
      <p>❌ Postcode: ${dq.missing?.postcode || 0}</p>
      <p>❌ Emergency Contact: ${dq.missing?.emergency_contact || 0}</p>
    </div>
    <div><h3>Duplicates Found</h3>
      <p>📧 Duplicate Emails: ${dq.duplicates?.email_count || 0}</p>
      <p>📱 Duplicate Phones: ${dq.duplicates?.phone_count || 0}</p>
    </div>
  </div>

  <div class="footer">Generated by Just Vitality Clinic System on ${new Date().toLocaleString()} | Exported by: ${user?.username}</div>
</body></html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div data-testid="analytics-view" className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /></button>
            <div>
              <h1 className="text-lg md:text-2xl font-bold"><span className="text-violet-500">Clinic</span> Analytics</h1>
              <p className="text-[10px] md:text-xs text-slate-500 hidden sm:block">Comprehensive Business Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 self-end sm:self-auto">
            <span className="text-xs md:text-sm text-slate-400">Logged as <span className="text-white font-medium">{user?.username}</span></span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-red-400 hover:text-red-300 text-xs md:text-sm">Logout</Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="glass-panel p-3 md:p-4 rounded-xl flex flex-wrap gap-2 md:gap-4 items-end">
          <div className="flex-1 min-w-[120px]">
            <Label className="text-[10px] md:text-xs text-slate-400 uppercase">Start</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-950 border-slate-800 w-full mt-1 text-xs md:text-sm" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Label className="text-[10px] md:text-xs text-slate-400 uppercase">End</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-950 border-slate-800 w-full mt-1 text-xs md:text-sm" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={loadData} disabled={loading} className="bg-violet-600 hover:bg-violet-700 flex-1 sm:flex-none">
              {loading ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Filter className="w-3 h-3 md:w-4 md:h-4" />}<span className="ml-1 md:ml-2">Apply</span>
            </Button>
            <Button size="sm" onClick={handleExportReport} variant="outline" className="border-slate-700 flex-1 sm:flex-none">
              <Download className="w-3 h-3 md:w-4 md:h-4" /><span className="ml-1 md:ml-2 hidden sm:inline">Export</span><span className="ml-1 sm:hidden">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
      ) : (
        <div className="container mx-auto px-3 md:px-4 pb-12" ref={printRef}>
          <Tabs defaultValue="overview" className="w-full">
            <div className="overflow-x-auto mb-4 md:mb-6 pb-2">
              <TabsList className="bg-slate-800 min-w-max">
                <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="consultants" className="text-xs md:text-sm">Staff</TabsTrigger>
                <TabsTrigger value="treatments" className="text-xs md:text-sm">Treatments</TabsTrigger>
                <TabsTrigger value="patients" className="text-xs md:text-sm">Patients</TabsTrigger>
                <TabsTrigger value="queue" className="text-xs md:text-sm">Queue</TabsTrigger>
                <TabsTrigger value="geographic" className="text-xs md:text-sm">Geo</TabsTrigger>
                <TabsTrigger value="quality" className="text-xs md:text-sm">Quality</TabsTrigger>
              </TabsList>
            </div>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              {/* KPI Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-panel p-6 rounded-xl border-l-4 border-violet-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-slate-400 uppercase">Total Visits</p><p className="text-3xl font-bold text-white tabular-nums">{data?.visit_trends?.total_visits || 0}</p></div>
                    <Activity className="w-8 h-8 text-violet-500 opacity-50" />
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-slate-400 uppercase">Unique Patients</p><p className="text-3xl font-bold text-white tabular-nums">{data?.new_vs_returning?.unique_patients || 0}</p></div>
                    <Users className="w-8 h-8 text-blue-500 opacity-50" />
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl border-l-4 border-emerald-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-slate-400 uppercase">New Registrations</p><p className="text-3xl font-bold text-white tabular-nums">{data?.new_vs_returning?.new_registrations || 0}</p></div>
                    <UserPlus className="w-8 h-8 text-emerald-500 opacity-50" />
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl border-l-4 border-amber-500">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-slate-400 uppercase">Avg/Day</p><p className="text-3xl font-bold text-white tabular-nums">{data?.visit_trends?.avg_daily || 0}</p></div>
                    <TrendingUp className="w-8 h-8 text-amber-500 opacity-50" />
                  </div>
                </div>
              </div>

              {/* Peak/Worst Days */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs text-emerald-400 font-bold uppercase mb-2">🏆 Best Day</h3>
                  <p className="text-2xl font-bold text-white">{data?.visit_trends?.peak_day?.date || 'N/A'}</p>
                  <p className="text-slate-400 text-sm">{data?.visit_trends?.peak_day?.count || 0} visits</p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs text-red-400 font-bold uppercase mb-2">📉 Worst Day</h3>
                  <p className="text-2xl font-bold text-white">{data?.visit_trends?.worst_day?.date || 'N/A'}</p>
                  <p className="text-slate-400 text-sm">{data?.visit_trends?.worst_day?.count || 0} visits</p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs text-blue-400 font-bold uppercase mb-2">🔄 Repeat Rate</h3>
                  <p className="text-2xl font-bold text-white">{data?.new_vs_returning?.repeat_rate || 0}%</p>
                  <p className="text-slate-400 text-sm">Patients with 2+ visits</p>
                </div>
              </div>

              {/* Daily Visits Chart */}
              <div className="glass-panel p-6 rounded-xl mb-8">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Daily Visits Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorVisits)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Heatmap */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Visit Heatmap (Day & Hour)</h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '60px repeat(12, 1fr)' }}>
                      <div></div>
                      {[8,9,10,11,12,13,14,15,16,17,18,19].map(h => (<div key={h} className="text-[10px] text-slate-500 text-center font-mono">{h}:00</div>))}
                    </div>
                    {days.map((day, dayIndex) => (
                      <div key={day} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(12, 1fr)' }}>
                        <div className="text-xs text-slate-400 font-medium flex items-center">{day}</div>
                        {[8,9,10,11,12,13,14,15,16,17,18,19].map(hour => {
                          const cellData = heatmapData.find(d => d.day === day && d.hour === `${hour}:00`);
                          return (<div key={`${day}-${hour}`} className={`h-8 rounded flex items-center justify-center text-[10px] text-transparent hover:text-white transition-all cursor-default ${getHeatColor(cellData?.count || 0)}`} title={`${day} ${hour}:00 - ${cellData?.count || 0} visits`}>{cellData?.count || 0}</div>);
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* CONSULTANTS TAB */}
            <TabsContent value="consultants">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Consultant Performance</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={consultantData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#64748b" fontSize={10} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={80} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Distribution</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={consultantData} cx="50%" cy="50%" labelLine={false} label={({ name, percentage }) => `${name} ${percentage}%`} outerRadius={100} fill="#8884d8" dataKey="count">
                          {consultantData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-xl mt-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Detailed Statistics</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-3 text-left">Consultant</th><th className="p-3 text-left">Visits</th><th className="p-3 text-left">Share</th></tr></thead>
                  <tbody>
                    {consultantData.map((c, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="p-3 font-bold text-white">{c.name}</td>
                        <td className="p-3 text-slate-300">{c.count}</td>
                        <td className="p-3"><Badge className="bg-blue-500/20 text-blue-400">{c.percentage}%</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TREATMENTS TAB */}
            <TabsContent value="treatments">
              <div className="glass-panel p-6 rounded-xl mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Top Treatments</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={treatmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Treatment Details</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-3 text-left">Treatment</th><th className="p-3 text-left">Count</th><th className="p-3 text-left">Share</th></tr></thead>
                  <tbody>
                    {(data?.treatment_mix?.treatments || []).slice(0, 20).map((t, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="p-3 font-bold text-white">{t.name}</td>
                        <td className="p-3 text-slate-300">{t.count}</td>
                        <td className="p-3"><Badge className="bg-emerald-500/20 text-emerald-400">{t.percentage}%</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* PATIENTS TAB */}
            <TabsContent value="patients">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-emerald-400 uppercase mb-4">New vs Returning</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">First-time Visits</span>
                      <span className="text-2xl font-bold text-white">{data?.new_vs_returning?.new_patient_visits || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Returning Visits</span>
                      <span className="text-2xl font-bold text-white">{data?.new_vs_returning?.returning_visits || 0}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                      <span className="text-slate-400">Repeat Rate</span>
                      <span className="text-2xl font-bold text-emerald-400">{data?.new_vs_returning?.repeat_rate || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><UserX className="w-4 h-4" /> Inactive Patients</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">60+ days inactive</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400">{data?.inactive_patients?.count_60 || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">90+ days inactive</span>
                      <Badge className="bg-red-500/20 text-red-400">{data?.inactive_patients?.count_90 || 0}</Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Inactive Patients Lists */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Follow-up List (90+ days)</h3>
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Phone</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Last Visit</th><th className="p-2 text-left">Days</th></tr></thead>
                    <tbody>
                      {(data?.inactive_patients?.over_90_days || []).slice(0, 20).map((p, i) => (
                        <tr key={i} className="border-b border-slate-800">
                          <td className="p-2 font-bold text-white">{p.name}</td>
                          <td className="p-2 text-slate-400">{p.phone}</td>
                          <td className="p-2 text-slate-400 text-xs">{p.email}</td>
                          <td className="p-2 text-slate-400">{p.last_visit}</td>
                          <td className="p-2"><Badge className="bg-red-500/20 text-red-400">{p.days_since}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* QUEUE & ALERTS TAB */}
            <TabsContent value="queue">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Queue Performance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Check-ins</span>
                      <span className="text-2xl font-bold text-white">{data?.queue_analytics?.total_checkins || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Completed (DONE)</span>
                      <span className="text-2xl font-bold text-emerald-400">{data?.queue_analytics?.total_completed || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Completion Rate</span>
                      <span className="text-2xl font-bold text-white">{data?.queue_analytics?.completion_rate || 0}%</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                      <span className="text-slate-400">Avg Check-ins/Day</span>
                      <span className="text-xl font-bold text-blue-400">{data?.queue_analytics?.avg_checkins_per_day || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-red-400 uppercase mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alert Analysis</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Check-ins with Alerts</span>
                      <span className="text-2xl font-bold text-red-400">{data?.alerts_analytics?.checkins_with_alerts || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Alert Rate</span>
                      <span className="text-2xl font-bold text-white">{data?.alerts_analytics?.alert_rate || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Top Alert Types</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-3 text-left">Alert</th><th className="p-3 text-left">Count</th></tr></thead>
                  <tbody>
                    {(data?.alerts_analytics?.top_alerts || []).map((a, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="p-3 text-white">{a.alert}</td>
                        <td className="p-3"><Badge className="bg-red-500/20 text-red-400">{a.count}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* GEOGRAPHIC TAB */}
            <TabsContent value="geographic">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Patient Distribution by City</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#64748b" fontSize={10} />
                        <YAxis type="category" dataKey="city" stroke="#64748b" fontSize={10} width={100} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                        <Bar dataKey="patient_count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Patients" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">City Statistics</h3>
                  <ScrollArea className="h-80">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/50 text-xs uppercase text-slate-400"><tr><th className="p-2 text-left">City</th><th className="p-2 text-left">Patients</th><th className="p-2 text-left">Visits</th><th className="p-2 text-left">Share</th></tr></thead>
                      <tbody>
                        {(data?.geographic?.cities || []).map((c, i) => (
                          <tr key={i} className="border-b border-slate-800">
                            <td className="p-2 font-bold text-white">{c.city}</td>
                            <td className="p-2 text-slate-300">{c.patient_count}</td>
                            <td className="p-2 text-slate-300">{c.visit_count}</td>
                            <td className="p-2"><Badge className="bg-amber-500/20 text-amber-400">{c.percentage}%</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* DATA QUALITY TAB */}
            <TabsContent value="quality">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="glass-panel p-6 rounded-xl border-l-4 border-emerald-500">
                  <h3 className="text-xs text-emerald-400 font-bold uppercase mb-2">Completeness Score</h3>
                  <p className="text-4xl font-bold text-white">{data?.data_quality?.avg_completeness_score || 0}%</p>
                  <p className="text-slate-400 text-sm">Average across {data?.data_quality?.total_patients || 0} patients</p>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-xs text-red-400 font-bold uppercase mb-4 flex items-center gap-2"><XCircle className="w-4 h-4" /> Missing Data</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Email</span><Badge className="bg-red-500/20 text-red-400">{data?.data_quality?.missing?.email || 0}</Badge></div>
                    <div className="flex justify-between"><span className="text-slate-400">Phone</span><Badge className="bg-red-500/20 text-red-400">{data?.data_quality?.missing?.phone || 0}</Badge></div>
                    <div className="flex justify-between"><span className="text-slate-400">Postcode</span><Badge className="bg-red-500/20 text-red-400">{data?.data_quality?.missing?.postcode || 0}</Badge></div>
                    <div className="flex justify-between"><span className="text-slate-400">Emergency</span><Badge className="bg-red-500/20 text-red-400">{data?.data_quality?.missing?.emergency_contact || 0}</Badge></div>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-xs text-yellow-400 font-bold uppercase mb-4 flex items-center gap-2"><FileWarning className="w-4 h-4" /> Duplicates Found</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Duplicate Emails</span><Badge className="bg-yellow-500/20 text-yellow-400">{data?.data_quality?.duplicates?.email_count || 0}</Badge></div>
                    <div className="flex justify-between"><span className="text-slate-400">Duplicate Phones</span><Badge className="bg-yellow-500/20 text-yellow-400">{data?.data_quality?.duplicates?.phone_count || 0}</Badge></div>
                  </div>
                </div>
              </div>
              
              {/* Duplicate Details */}
              {((data?.data_quality?.duplicates?.emails?.length > 0) || (data?.data_quality?.duplicates?.phones?.length > 0)) && (
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Duplicate Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data?.data_quality?.duplicates?.emails?.length > 0 && (
                      <div>
                        <h4 className="text-xs text-yellow-400 mb-2">Duplicate Emails</h4>
                        <div className="space-y-1">
                          {data.data_quality.duplicates.emails.map((e, i) => (
                            <div key={i} className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded">{e}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {data?.data_quality?.duplicates?.phones?.length > 0 && (
                      <div>
                        <h4 className="text-xs text-yellow-400 mb-2">Duplicate Phones</h4>
                        <div className="space-y-1">
                          {data.data_quality.duplicates.phones.map((p, i) => (
                            <div key={i} className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded">{p}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <footer className="border-t border-slate-800 p-4 text-center text-xs text-slate-600">
        System by <a href="mailto:dyczkowski.kamil@gmail.com" className="text-blue-500 hover:underline">Kamil Dyczkowski</a> 2026
      </footer>
    </div>
  );
};

export default Analytics;
