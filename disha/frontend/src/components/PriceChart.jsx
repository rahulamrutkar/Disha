import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function PriceChart({ series }) {
  const data = series.map((d) => ({ ...d, label: d.date.slice(5) }))

  return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <p className="mb-3 text-xs uppercase tracking-wider text-muted">30-Day Close Price (₹)</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A537" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#D4A537" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2A3B57" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8A93A6', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#2A3B57' }}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: '#8A93A6', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: '#16243A',
                border: '1px solid #2A3B57',
                borderRadius: 2,
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
              }}
              labelStyle={{ color: '#8A93A6' }}
              itemStyle={{ color: '#E8C97A' }}
              formatter={(value) => [`₹${value}`, 'Close']}
            />
            <Area type="monotone" dataKey="close" stroke="#D4A537" strokeWidth={2} fill="url(#priceFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
