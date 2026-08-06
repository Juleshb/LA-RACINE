import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppIcon } from '@/src/components/AppIcon';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Button, ErrorText, Input, Muted } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/context/LanguageContext';
import { accent, brand, colors, radius, school, spacing } from '@/src/theme';

export default function LoginScreen() {
  const { user, loading, login, verifyOtp, resendOtp } = useAuth();
  const { t, language, setLanguage, languages } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  if (!loading && user) return <Redirect href="/(tabs)" />;

  const handleLogin = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (result.ok) return;
    if ('requiresOtp' in result && result.requiresOtp) {
      setChallengeId(result.challengeId);
      setInfo(result.message || t('login.otpHint'));
      return;
    }
    if ('wrongRole' in result && result.wrongRole) {
      setError(t('login.wrongRole'));
      return;
    }
    setError(('error' in result && result.error) || t('login.failed'));
  };

  const handleVerify = async () => {
    if (!challengeId) return;
    setError('');
    setBusy(true);
    const result = await verifyOtp(challengeId, otp);
    setBusy(false);
    if (result.ok) return;
    setError(('error' in result && result.error) || t('login.otpWrong'));
  };

  const handleResend = async () => {
    if (!challengeId) return;
    setError('');
    setBusy(true);
    try {
      await resendOtp(challengeId);
      setInfo(t('login.otpResent'));
    } catch (err: any) {
      setError(err.message || t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.heroBand}>
        <View style={styles.bubbleRow}>
          <AppIcon name="star" size={22} color={accent.yellow} />
          <AppIcon name="library" size={22} color={brand[200]} />
          <AppIcon name="rainbow" size={22} color={accent.magenta} />
        </View>
        <BrandLogo size="xl" centered />
        <Text style={styles.heroName}>{school.name}</Text>
        <Text style={styles.heroTag}>{t('login.tagline')}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.langRow}>
            {languages.map((lang) => {
              const selected = language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setLanguage(lang.code)}
                  style={[styles.langPill, selected && styles.langPillActive]}
                >
                  <Text style={[styles.langPillText, selected && styles.langPillTextActive]}>
                    {lang.code.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.titleRow}>
            <AppIcon name={challengeId ? 'magic' : 'wave'} size={28} color={colors.brand} />
            <Text style={styles.formTitle}>
              {challengeId ? t('login.otpTitle') : t('login.signIn')}
            </Text>
          </View>
          <Muted>{challengeId ? t('login.otpHint') : t('login.tagline')}</Muted>

          <View style={styles.form}>
            {!challengeId ? (
              <>
                <Input
                  label={t('login.email')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@school.com"
                />
                <Input
                  label={t('login.password')}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                />
                <Button
                  title={t('login.signIn')}
                  icon="rocket"
                  onPress={handleLogin}
                  loading={busy}
                  disabled={!email || !password}
                />
              </>
            ) : (
              <>
                {info ? (
                  <View style={styles.info}>
                    <AppIcon name="mail" size={18} color={colors.brandDark} />
                    <Text style={styles.infoText}>{info}</Text>
                  </View>
                ) : null}
                <Input
                  label={t('login.otpPlaceholder')}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                />
                <Button
                  title={t('login.verify')}
                  icon="magic"
                  onPress={handleVerify}
                  loading={busy}
                  disabled={!otp}
                />
                <Button
                  title={t('login.resend')}
                  variant="secondary"
                  onPress={handleResend}
                  disabled={busy}
                />
                <Button
                  title={t('common.backHome')}
                  variant="secondary"
                  onPress={() => {
                    setChallengeId(null);
                    setOtp('');
                    setInfo('');
                  }}
                />
              </>
            )}
            <ErrorText>{error}</ErrorText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand[800],
  },
  heroBand: {
    paddingTop: 56,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: brand[800],
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 4,
  },
  heroName: {
    marginTop: spacing.sm,
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  heroTag: {
    fontSize: 16,
    color: brand[200],
    fontWeight: '700',
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -12,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 2,
    borderColor: colors.brandBorder,
  },
  langPillActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brandDark,
  },
  langPillTextActive: {
    color: '#fff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: colors.brandDark,
  },
  form: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.brandBorder,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.yellowSoft,
    padding: 12,
    borderRadius: radius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.brandDark,
  },
});
