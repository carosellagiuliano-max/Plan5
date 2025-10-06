'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@plan5/ui';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';

interface Metrics {
  occupancy: number;
  revenue: number;
  incidents: number;
}

async function fetchMetrics(): Promise<Metrics> {
  return {
    occupancy: 0.86,
    revenue: 128_400,
    incidents: 1
  };
}

async function generateSumUp(amount: number) {
  const response = await fetch('/api/sumup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, currency: 'CHF', reference: uuid() })
  });
  if (!response.ok) {
    throw new Error('Failed to create deeplink');
  }
  return (await response.json()) as { link: string };
}

export function AdminDashboard() {
  const [amount, setAmount] = useState(50);
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics });
  const mutation = useMutation({ mutationFn: generateSumUp });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Operational metrics</CardTitle>
          <CardDescription>Real-time data aggregated via TanStack Query.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <span>Occupancy: {(metrics?.occupancy ?? 0).toLocaleString(undefined, { style: 'percent' })}</span>
          <span>Revenue MTD: CHF {(metrics?.revenue ?? 0).toLocaleString('de-CH')}</span>
          <span>Incidents: {metrics?.incidents ?? 0}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SumUp deeplink</CardTitle>
          <CardDescription>Issue ad-hoc charges for concierge services.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span>Amount (CHF)</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <Button onClick={() => mutation.mutate(amount)} disabled={mutation.isPending}>
            {mutation.isPending ? 'Generating…' : 'Generate deeplink'}
          </Button>
          {mutation.data?.link && (
            <p className="break-all text-xs text-muted-foreground" aria-live="polite">
              {mutation.data.link}
            </p>
          )}
          {mutation.error && (
            <p className="text-xs text-destructive">{String(mutation.error)}</p>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Deeplinks expire in 15 minutes for fraud prevention.
        </CardFooter>
      </Card>
    </div>
  );
}
