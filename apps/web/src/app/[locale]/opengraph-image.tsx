import { ImageResponse } from 'next/og';
import { assertLocale } from '@/i18n/config';

export const size = {
  width: 1200,
  height: 630
};

export const contentType = 'image/png';

export default function Image({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(135deg, #1f2937, #111827)',
          color: 'white',
          padding: '64px',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 600 }}>Plan5 · {params.locale}</div>
      </div>
    ),
    size
  );
}
