import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Button, Card, ErrorText, Input, LoadingBlock, Muted, Screen, Subtitle } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/lib/api';
import { brand, colors, school, spacing } from '@/src/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout, refreshMe } = useAuth();
  const router = useRouter();
  const [photo, setPhoto] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const source = await api.getMyStudentPhotoSource();
        setPhoto(source);
      } catch {
        setPhoto(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changePassword = async () => {
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      setMessage('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshMe();
    } catch (err: any) {
      setError(err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Card style={styles.profileCard}>
          {photo ? (
            <Image source={photo} style={styles.avatar} />
          ) : (
            <View style={StyleSheet.flatten([styles.avatar, styles.avatarFallback])}>
              <Text style={styles.initials}>
                {(user?.firstName?.[0] || 'S').toUpperCase()}
              </Text>
            </View>
          )}
          <Subtitle>
            {user?.firstName} {user?.lastName}
          </Subtitle>
          <Muted>{user?.email}</Muted>
          <View style={styles.schoolRow}>
            <BrandLogo size="sm" />
            <Text style={styles.schoolName}>{school.name}</Text>
          </View>
        </Card>

        <Card style={styles.form}>
          <Subtitle>Change password</Subtitle>
          <Input
            label="Current password"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Input
            label="New password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Input
            label="Confirm new password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <ErrorText>{error}</ErrorText>
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <Button
            title="Update password"
            onPress={changePassword}
            loading={saving}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          />
        </Card>

        <Button
          title="Sign out"
          icon="logout"
          variant="danger"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  pad: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandSoft,
    borderWidth: 3,
    borderColor: brand[300],
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.brandDark,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  schoolName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brandDark,
  },
  form: {
    gap: spacing.md,
  },
  success: {
    color: colors.success,
    fontWeight: '600',
  },
});
}

