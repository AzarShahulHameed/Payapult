// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../api/client';
import { C } from '../constants';
import { Card, Stat, Spinner } from '../components/UI';
import useStore from '../store/useStore';

export default function Dashboard() {
  const { user } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    analyticsAPI.dashboard()
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeCount = data?.employees?.find(e => e.status === 'active')?.count || 0;
  const onLeaveCount = data?.employees?.find(e => e.status === 'on_leave')?.count || 0;

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 50%, ${C.steel} 100%)`,
        borderRadius: 18, padding: '32px 36px', marginBottom: 28, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(91,164,212,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: C.sky, fontWeight: 600, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
            {time.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long' })} · {user?.timezone || 'Asia/Dubai'}
          </div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 28, fontWeight: 800, color: C.white, margin: '0 0 6px', letterSpacing: -0.5 }}>
            {greeting}, {user?.first_name} 👋
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            {data?.latestPayRun
              ? <>Latest payrun: <b style={{ color: C.white }}>{data.latestPayRun.status}</b> · Pay date: <b style={{ color: C.white }}>{data.latestPayRun.pay_date?.split('T')[0]}</b></>
              : 'No pay runs yet — create your first one!'
            }
          </p>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
            <Stat label="Total Payroll" value={data?.latestPayRun ? `${data.latestPayRun.currency} ${parseFloat(data.latestPayRun.total_gross || 0).toLocaleString()}` : '—'} sub="Latest pay run" color={C.navy} />
            <Stat label="Active Employees" value={activeCount} sub={`${onLeaveCount} on leave`} color={C.steel} />
            <Stat label="Active Loans" value={data?.loans?.active_loans || 0} sub={`${data?.loans?.total_loan_amount ? parseFloat(data.loans.total_loan_amount).toLocaleString() : '0'} outstanding`} color={C.purple} />
            <Stat label="Leave Today" value={data?.leave?.on_leave_today || 0} sub={`${data?.leave?.pending || 0} pending approval`} color={C.warning} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 24 }}>
            <Card>
              <div style={{ fontWeight: 700, color: C.navy, marginBottom: 16, fontSize: 14 }}>Payroll Trend</div>
              {data?.monthlyTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.monthlyTrend}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.sky} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`}/>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <Tooltip formatter={v => [`AED ${parseFloat(v).toLocaleString()}`, 'Gross']} contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}/>
                    <Area type="monotone" dataKey="total_gross" stroke={C.steel} strokeWidth={2} fill="url(#gA)"/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>No payroll data yet</div>}
            </Card>

            <Card>
              <div style={{ fontWeight: 700, color: C.navy, marginBottom: 16, fontSize: 14 }}>Dept. Spend</div>
              {data?.deptSpend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.deptSpend} layout="vertical">
                    <XAxis type="number" hide/>
                    <YAxis dataKey="dept" type="category" width={80} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v => [`AED ${parseFloat(v).toLocaleString()}`, 'Spend']} contentStyle={{ borderRadius: 8, fontSize: 12 }}/>
                    <Bar dataKey="total_spend" fill={C.sky} radius={[0, 6, 6, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>No department data</div>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
