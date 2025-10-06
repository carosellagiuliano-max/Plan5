'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@plan5/ui';
import type { OrderPayload, ProductSummary } from '@plan5/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';

async function fetchProducts(locale: string): Promise<ProductSummary[]> {
  const response = await fetch(`/api/products?locale=${locale}`, {
    next: { tags: ['shop'] }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
}

async function createOrderMutation(payload: OrderPayload) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-idempotency-key': payload.idempotencyKey ?? uuid()
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Checkout failed');
  }
  return response.json();
}

export function ShopGrid({ locale }: { locale: string }) {
  const t = useTranslations('shop');
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', locale],
    queryFn: () => fetchProducts(locale)
  });

  const mutation = useMutation({
    mutationFn: createOrderMutation,
    onMutate: async (variables) => {
      setMessage('Processing order…');
      await queryClient.cancelQueries({ queryKey: ['products', locale] });
      const previous = queryClient.getQueryData<ProductSummary[]>(['products', locale]);
      queryClient.setQueryData<ProductSummary[]>(['products', locale], (old) =>
        old?.map((product) =>
          product.id === variables.productId
            ? { ...product, available: product.available && product.id !== 'gift-card' }
            : product
        ) ?? []
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      setMessage('Order failed');
      if (context?.previous) {
        queryClient.setQueryData(['products', locale], context.previous);
      }
    },
    onSuccess: (data) => {
      setMessage(`Order ${data.orderId} confirmed`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products', locale] });
    }
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{String(error)}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>{product.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: product.currency
              }).format(product.price)}
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              disabled={!product.available || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  idempotencyKey: uuid(),
                  productId: product.id,
                  quantity: 1,
                  locale: locale as OrderPayload['locale']
                })
              }
            >
              {t('cta')}
            </Button>
          </CardFooter>
        </Card>
      ))}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
