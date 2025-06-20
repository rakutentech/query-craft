import { Metadata } from 'next';
import LayoutContent from '@/components/LayoutContent';

export const metadata: Metadata = {
  title: 'Query Craft',
  description: 'A powerful database query tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return <LayoutContent>{children}</LayoutContent>;
}
