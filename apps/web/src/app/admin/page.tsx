'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageTitle } from '@/components/admin/page-title';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { adminApi } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const money = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function AdminDashboardPage(): JSX.Element {
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard });
  return (
    <section>
      <PageTitle title={messages.admin.dashboard.title} />
      <div className="grid grid-cols-4 gap-4">
        <Metric label={messages.admin.dashboard.signups} value={data?.today.signups ?? 0} />
        <Metric label={messages.admin.dashboard.payingUsers} value={data?.today.payingUsers ?? 0} />
        <Metric
          label={messages.admin.dashboard.revenue}
          value={money(data?.today.revenueCents ?? 0)}
        />
        <Metric
          label={messages.admin.dashboard.roas}
          value={money(data?.today.estimatedRoasCents ?? 0)}
        />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold">{messages.admin.dashboard.weekly}</h2>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.weekly ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                formatter={(value, name) =>
                  name === 'revenueCents' ? money(Number(value)) : value
                }
              />
              <Area dataKey="signups" stroke="#2563eb" fill="#93c5fd" />
              <Area dataKey="revenueCents" stroke="#16a34a" fill="#86efac" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
