import DatabaseQueryApp from '../components/DatabaseQueryApp';
import { getConversations } from '@/app/lib/db';

export default async function Home() {
  const conversations = await getConversations();
  return <DatabaseQueryApp initialConversations={conversations} />;
}