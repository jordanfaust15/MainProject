'use client';

import dynamic from 'next/dynamic';

const ReentryApp = dynamic(
  () => import('@/components/ReentryApp').then((mod) => mod.ReentryApp),
  { ssr: false }
);

export default function Home() {
  return <ReentryApp />;
}
