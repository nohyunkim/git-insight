import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CHART_COLORS = ['#7dd3fc', '#fcd34d', '#86efac', '#f9a8d4', '#c4b5fd']

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const [{ name, value }] = payload

  return (
    <div className="chart-tooltip">
      <p>{name}</p>
      <strong>{value}</strong>
    </div>
  )
}

function LanguageChart({ languages }) {
  if (!languages.length) {
    return <p className="muted">표시할 언어 데이터가 아직 없습니다.</p>
  }

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={languages}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={86}
            paddingAngle={4}
          >
            {languages.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <ul className="legend-list">
        {languages.map((entry, index) => (
          <li key={entry.name}>
            <span
              className="legend-dot"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span>{entry.name}</span>
            <strong>{entry.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityChart({ events }) {
  if (!events.length) {
    return <p className="muted">표시할 활동 이벤트가 아직 없습니다.</p>
  }

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={events} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'rgba(125, 211, 252, 0.08)' }}
          />
          <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#7dd3fc" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export { ActivityChart, LanguageChart }
