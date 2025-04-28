import SettingsPage from '../../components/SettingsPage';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function Settings() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth/signin');
  }

  return <SettingsPage />;
}