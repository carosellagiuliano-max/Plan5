'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BookingPayload, BookingStep } from '@plan5/types';

type BookingState = {
  step: BookingStep;
  payload: BookingPayload;
  setStep: (step: BookingStep) => void;
  updatePayload: (data: Partial<BookingPayload>) => void;
  reset: () => void;
};

const initialState: BookingPayload = {
  customerName: '',
  customerEmail: '',
  partySize: 2,
  requestedAt: new Date().toISOString()
};

export const useBookingStore = create<BookingState>()(
  devtools((set) => ({
    step: 'details',
    payload: initialState,
    setStep: (step) => set({ step }),
    updatePayload: (data) =>
      set((state) => ({
        payload: { ...state.payload, ...data }
      })),
    reset: () => set({ step: 'details', payload: initialState })
  }))
);
