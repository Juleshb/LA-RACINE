import { Redirect } from 'expo-router';
import { LoadingBlock, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
