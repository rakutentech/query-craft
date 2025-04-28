import DatabaseQueryApp from '../components/DatabaseQueryApp';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/auth/signin');
  }

  return <DatabaseQueryApp />;
}