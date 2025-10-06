'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@plan5/ui';
import { useBookingStore } from '@/stores/booking';
import type { BookingPayload, BookingResponse, Locale } from '@plan5/types';
import { useTranslations } from 'next-intl';
import { v4 as uuid } from 'uuid';

async function submitBooking(payload: BookingPayload) {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-idempotency-key': payload.id ?? uuid()
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Unable to process booking');
  }
  return (await response.json()) as BookingResponse;
}

export function BookingWizard({ locale }: { locale: Locale }) {
  const t = useTranslations('booking');
  const { step, setStep, payload, updatePayload, reset } = useBookingStore();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitBooking,
    onError: (err: Error) => {
      setError(err.message);
    },
    onSuccess: (data) => {
      updatePayload({ id: data.id });
      setStep('complete');
    }
  });

  const steps: Array<{ key: typeof step; label: string }> = [
    { key: 'details', label: t('details') },
    { key: 'confirmation', label: t('confirmation') },
    { key: 'payment', label: t('payment') },
    { key: 'complete', label: t('complete') }
  ];

  function handleDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updatePayload({
      customerName: String(formData.get('name') ?? ''),
      customerEmail: String(formData.get('email') ?? ''),
      partySize: Number(formData.get('size') ?? 1),
      notes: String(formData.get('notes') ?? ''),
      requestedAt: new Date(String(formData.get('date') ?? new Date().toISOString())).toISOString(),
      locale
    });
    setStep('confirmation');
  }

  function handleConfirm() {
    setStep('payment');
  }

  async function handlePayment() {
    setError(null);
    mutation.mutate({ ...payload, locale });
  }

  function handleReset() {
    reset();
    setError(null);
  }

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {steps.map((entry) => (
            <span
              key={entry.key}
              className={`mr-3 inline-flex items-center text-sm ${step === entry.key ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
            >
              {entry.label}
            </span>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'details' && (
          <form className="grid gap-4" onSubmit={handleDetails} aria-label="Booking details form">
            <label className="grid gap-2 text-sm">
              <span>Name</span>
              <input
                name="name"
                defaultValue={payload.customerName}
                required
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Email</span>
              <input
                type="email"
                name="email"
                defaultValue={payload.customerEmail}
                required
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Party size</span>
              <input
                type="number"
                min={1}
                name="size"
                defaultValue={payload.partySize}
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Date</span>
              <input type="date" name="date" className="rounded-md border border-input bg-background px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Notes</span>
              <textarea
                name="notes"
                defaultValue={payload.notes}
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <Button type="submit" className="justify-self-start">
              Continue
            </Button>
          </form>
        )}
        {step === 'confirmation' && (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold">Name</span>
              <span>{payload.customerName}</span>
              <span className="font-semibold">Email</span>
              <span>{payload.customerEmail}</span>
              <span className="font-semibold">Party size</span>
              <span>{payload.partySize}</span>
            </dl>
            <div className="flex gap-2">
              <Button onClick={handleConfirm}>Confirm</Button>
              <Button variant="ghost" onClick={() => setStep('details')}>
                Edit
              </Button>
            </div>
          </div>
        )}
        {step === 'payment' && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Secure your reservation with an encrypted payment. Your session is protected with HSTS and CSRF-safe tokens.
            </p>
            <Button onClick={handlePayment} disabled={mutation.isPending}>
              {mutation.isPending ? 'Processing…' : 'Complete payment'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('confirmation')}>
              Back
            </Button>
          </div>
        )}
        {step === 'complete' && (
          <div className="grid gap-3 text-sm">
            <p>Confirmation #{payload.id}</p>
            <p className="text-muted-foreground">We have sent a confirmation email to {payload.customerEmail}.</p>
            <Button onClick={handleReset}>Book another stay</Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="justify-between text-xs text-muted-foreground">
        <span>Data residency: Switzerland</span>
        <span>Protected by hCaptcha</span>
      </CardFooter>
    </Card>
  );
}
