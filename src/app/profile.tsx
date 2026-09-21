import { ObservatoryPressable as Pressable, ObservatoryButton } from '@/components/observatory-button';
import { House, ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, Sparkles, Scale, Crosshair, Orbit, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/context/auth-context';
import { CelestialVisual } from '@/components/celestial-visual';
import { supabase } from '@/lib/supabase';
import { signInWithSocialProvider, type SocialProvider } from '@/lib/social-auth';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { makeRedirectUri } from 'expo-auth-session';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MotionSection } from '@/components/motion-section';
import { Text, TextInput } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AuthMode = 'signIn' | 'signUp' | 'reset';
type Feedback = { type: 'success' | 'error'; message: string } | null;

const profileStar = {
  id: 'astralys-profile-star',
  object_type: 'star' as const,
  visual_category: 'blue',
  apparent_magnitude: 1.8,
};

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Incorrect email address or password.';
  if (normalized.includes('user already registered')) return 'An account already exists with this email address.';
  if (normalized.includes('password should be')) return 'The password must contain at least 8 characters.';
  if (normalized.includes('email rate limit')) return 'Too many requests were sent. Try again in a few minutes.';
  if (normalized.includes('valid email')) return 'Enter a valid email address.';
  return message;
}

export default function ProfileScreen() {
  const { mode: entryMode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { loading, profile, profileLoading, refreshProfile, user, passwordRecovery, finishPasswordRecovery, callbackError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setDisplayName(profile.display_name);
    setCountry(profile.country ?? '');
  }, [profile]);

  useFocusEffect(useCallback(() => {
    if (entryMode === 'signIn' || entryMode === 'signUp') { setMode(entryMode); setFeedback(null); }
  }, [entryMode]));
  useEffect(() => { if (passwordRecovery) { setPassword(''); setFeedback(null); setShowPassword(false); } }, [passwordRecovery]);

  const switchMode = (nextMode: AuthMode) => {
    setFeedback(null);
    setShowPassword(false);
    setMode(nextMode);
  };

  const validateSignUp = () => {
    if (displayName.trim().length < 2) return 'The display name must contain at least 2 characters.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 8) return 'The password must contain at least 8 characters.';
    return null;
  };

  const submit = async () => {
    setFeedback(null);

    if (mode === 'reset') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setFeedback({ type: 'error', message: 'Enter a valid email address.' }); return; }
      setBusy(true);
      try {
        const redirectTo = makeRedirectUri({ scheme: 'astrelys', path: 'profile', queryParams: { recovery: '1' } });
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
        if (error) throw error;
        setFeedback({ type: 'success', message: 'If an account exists, a recovery email will arrive shortly. Open its link to choose a new password.' });
      } catch (caught) {
        setFeedback({ type: 'error', message: friendlyAuthError(caught instanceof Error ? caught.message : 'The recovery email could not be requested.') });
      } finally { setBusy(false); }
      return;
    }

    if (mode === 'signUp') {
      const validationError = validateSignUp();
      if (validationError) {
        setFeedback({ type: 'error', message: validationError });
        return;
      }
    } else if (!email.trim() || !password) {
      setFeedback({ type: 'error', message: 'Enter your email address and password.' });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              first_name: firstName.trim() || null,
              last_name: lastName.trim() || null,
              display_name: displayName.trim(),
              country: country.trim() || null,
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          await refreshProfile();
          setFeedback({ type: 'success', message: 'Your Astralys account has been created.' });
        } else {
          setFeedback({
            type: 'success',
            message: 'Account created. Check your email to confirm your address.',
          });
          setMode('signIn');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        setPassword('');
        setFeedback({ type: 'success', message: 'Signed in successfully.' });
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Something went wrong.';
      setFeedback({ type: 'error', message: friendlyAuthError(message) });
    } finally {
      setBusy(false);
    }
  };

  const submitSocial = async (provider: SocialProvider) => {
    setSocialBusy(provider);
    setFeedback(null);

    try {
      const result = await signInWithSocialProvider(provider);
      if (result.status === 'success') {
        setFeedback({ type: 'success', message: `Signed in with ${provider === 'google' ? 'Google' : 'Apple'}.` });
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Social sign-in failed.';
      const providerName = provider === 'google' ? 'Google' : 'Apple';
      setFeedback({
        type: 'error',
        message: message.toLowerCase().includes('not enabled') || message.toLowerCase().includes('unsupported provider')
          ? `${providerName} sign-in is not available yet. Please use email instead.`
          : friendlyAuthError(message),
      });
    } finally {
      setSocialBusy(null);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if ((firstName.trim().length > 0 && firstName.trim().length < 2) || (lastName.trim().length > 0 && lastName.trim().length < 2) || displayName.trim().length < 2) {
      setFeedback({ type: 'error', message: 'Check the first name, last name and display name.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName.trim(),
        country: country.trim() || null,
      })
      .eq('id', user.id);

    if (error) {
      setFeedback({ type: 'error', message: 'The profile could not be saved.' });
    } else {
      await refreshProfile();
      setEditing(false);
      setFeedback({ type: 'success', message: 'Your information has been updated.' });
    }
    setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.auth.signOut();
    if (error) setFeedback({ type: 'error', message: 'Sign-out failed.' });
    else {
      setEmail('');
      setPassword('');
      setMode('signIn');
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#C8BAF5" />
        <Text style={styles.loadingText}>Checking your session…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View pointerEvents="none" style={styles.sky}>
        <View style={styles.glow} />
        <View style={[styles.star, styles.starOne]} />
        <View style={[styles.star, styles.starTwo]} />
        <View style={[styles.star, styles.starThree]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: navigationClearance(insets.bottom) + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <Text style={styles.brand}>ASTRALYS</Text>
            <View style={styles.securePill}>
              <View style={styles.secureDot} />
              <Text style={styles.secureText}>{user ? 'CONNECTED' : 'SECURE'}</Text>
            </View>
          </View>

          {passwordRecovery && user ? (
            <MotionSection style={styles.content}>
              <Text accessibilityRole="header" style={styles.title}>Choose a new password</Text>
              <View style={styles.formCard}>
                <FormField label="NEW PASSWORD" autoCapitalize="none" autoComplete="new-password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
                <Pressable accessibilityRole="button" onPress={() => setShowPassword(v => !v)} style={styles.signOutButton}><Text style={styles.signOutText}>{showPassword ? 'Hide password' : 'Show password'}</Text></Pressable>
                {feedback ? <FeedbackBanner feedback={feedback} /> : null}
                <Pressable accessibilityRole="button" disabled={busy} style={styles.primaryButton} onPress={async () => {
                  if (password.length < 8) { setFeedback({ type: 'error', message: 'Use at least 8 characters.' }); return; }
                  setBusy(true);
                  try {
                    const { error } = await supabase.auth.updateUser({ password });
                    if (error) throw error;
                    setPassword('');
                    finishPasswordRecovery();
                    setFeedback({ type: 'success', message: 'Password updated successfully.' });
                  } catch (caught) { setFeedback({ type: 'error', message: friendlyAuthError(caught instanceof Error ? caught.message : 'The password could not be updated.') }); }
                  finally { setBusy(false); }
                }}>{busy ? <ActivityIndicator color="#171321" /> : <Text style={styles.primaryButtonText}>Save new password</Text>}</Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setPassword(''); finishPasswordRecovery(); }} style={styles.signOutButton}><Text style={styles.signOutText}>Cancel</Text></Pressable>
              </View>
            </MotionSection>
          ) : user ? (
            <MotionSection style={styles.content}>
              <View style={styles.avatarScene}>
                <View style={styles.avatarOrbit} />
                <CelestialVisual animated object={{ ...profileStar, id: user.id }} size={104} />
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarText}>{(profile?.display_name || user.email || 'A').slice(0, 1).toUpperCase()}</Text>
                </View>
              </View>
              <Text accessibilityRole="header" style={styles.title}>{profile?.display_name || 'Astronomer'}</Text>
              <Text style={styles.subtitle}>{user.email}</Text>

              {feedback ? <FeedbackBanner feedback={feedback} /> : null}

              {profileLoading ? (
                <ActivityIndicator color="#C8BAF5" style={styles.profileLoader} />
              ) : editing ? (
                <View style={styles.formCard}>
                  <View style={styles.nameRow}>
                    <FormField label="FIRST NAME" value={firstName} onChangeText={setFirstName} />
                    <FormField label="LAST NAME" value={lastName} onChangeText={setLastName} />
                  </View>
                  <FormField label="DISPLAY NAME" value={displayName} onChangeText={setDisplayName} />
                  <FormField label="COUNTRY OR REGION (OPTIONAL)" value={country} onChangeText={setCountry} />
                  <View style={styles.editActions}>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(false)} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={saveProfile} style={styles.primaryButton}>
                      {busy ? <ActivityIndicator color="#171321" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.profileCard}>
                  <ProfileLine label="Full name" value={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Not provided'} />
                  <ProfileLine label="Country or region" value={profile?.country || 'Not provided'} />
                  <ProfileLine label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US') : 'Today'} last />
                </View>
              )}

              {!editing ? (
                <Pressable accessibilityRole="button" onPress={() => { setFeedback(null); setEditing(true); }} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Edit profile</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </MotionSection>
          ) : (
            <MotionSection replayKey={mode} style={styles.content}>
              <View style={styles.guestScene}>
                <View style={styles.guestOrbit} />
                <CelestialVisual animated object={profileStar} size={48} />
              </View>
              <Text accessibilityRole="header" style={styles.title}>{mode === 'reset' ? 'Reset password' : mode === 'signUp' ? 'Join Astralys' : 'Welcome back'}</Text>
              {mode === 'reset' ? <Text style={styles.subtitle}>Receive a reset link by email.</Text> : null}

              {mode !== 'reset' ? <>              <View style={styles.segment}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'signUp' }} aria-pressed={mode === 'signUp'} disabled={busy || socialBusy !== null} onPress={() => switchMode('signUp')} style={[styles.segmentButton, mode === 'signUp' && styles.segmentButtonActive]}>
                  <Text style={[styles.segmentText, mode === 'signUp' && styles.segmentTextActive]}>Create account</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'signIn' }} aria-pressed={mode === 'signIn'} onPress={() => switchMode('signIn')} style={[styles.segmentButton, mode === 'signIn' && styles.segmentButtonActive]}>
                  <Text style={[styles.segmentText, mode === 'signIn' && styles.segmentTextActive]}>Sign in</Text>
                </Pressable>
              </View>

              </> : null}
              <View style={styles.formCard}>
                {mode === 'signUp' ? (
                  <>
                    <FormField autoComplete="name" label="DISPLAY NAME" value={displayName} onChangeText={setDisplayName} />
                  </>
                ) : null}
                <FormField autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="EMAIL ADDRESS" value={email} onChangeText={setEmail} />
                {mode !== 'reset' ? <FormField
                  autoCapitalize="none"
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  label="PASSWORD"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                /> : null}
                {mode !== 'reset' ? <Pressable accessibilityRole="button" onPress={() => setShowPassword(v => !v)} style={styles.signOutButton}><Text style={styles.signOutText}>{showPassword ? 'Hide password' : 'Show password'}</Text></Pressable> : null}
                {mode === 'signIn' ? <Pressable accessibilityRole="button" onPress={() => { setPassword(''); switchMode('reset'); }} style={styles.signOutButton}><Text style={styles.signOutText}>Forgot password?</Text></Pressable> : null}
                {mode === 'reset' ? <Pressable accessibilityRole="button" onPress={() => switchMode('signIn')} style={styles.signOutButton}><Text style={styles.signOutText}>Back to sign in</Text></Pressable> : null}
                {callbackError ? <FeedbackBanner feedback={{ type: 'error', message: callbackError }} /> : null}
                {feedback ? <FeedbackBanner feedback={feedback} /> : null}
                <Pressable accessibilityRole="button" disabled={busy || socialBusy !== null} onPress={submit} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
                  {busy ? <ActivityIndicator color="#171321" /> : (
                    <>
                      <Text style={styles.primaryButtonText}>{mode === 'reset' ? 'Send reset link' : mode === 'signUp' ? 'Create account' : 'Sign in'}</Text>
                      <ArrowRight size={22} color="#171321" />
                    </>
                  )}
                </Pressable>
              </View>
{mode !== 'reset' ? <><View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
              <View style={styles.socialGroup}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || socialBusy !== null}
                  onPress={() => submitSocial('google')}
                  accessibilityLabel="Continue with Google"
                  style={[styles.socialButton, socialBusy !== null && styles.buttonDisabled]}>
                  <View style={[styles.socialMark, styles.googleMark]}>
                    <Text style={styles.googleMarkText}>G</Text>
                  </View>
                  <Text style={styles.socialButtonText}>Google</Text>
                  {socialBusy === 'google' ? <ActivityIndicator color="#DAD5E4" size="small" /> : <Text style={styles.socialChevron}>›</Text>}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || socialBusy !== null}
                  onPress={() => submitSocial('apple')}
                  accessibilityLabel="Continue with Apple"
                  style={[styles.socialButton, socialBusy !== null && styles.buttonDisabled]}>
                  <View style={[styles.socialMark, styles.appleMark]}>
                    <Text style={styles.appleMarkText}>A</Text>
                  </View>
                  <Text style={styles.socialButtonText}>Apple</Text>
                  {socialBusy === 'apple' ? <ActivityIndicator color="#DAD5E4" size="small" /> : <Text style={styles.socialChevron}>›</Text>}
                </Pressable>
              </View>



</> : null}
            </MotionSection>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FormFieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function FormField({ label, style, ...props }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} {...props} placeholderTextColor="#565E71" selectionColor="#BCAAEF" style={[styles.input, style]} />
    </View>
  );
}

function FeedbackBanner({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return (
    <View accessibilityRole={feedback.type === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.feedback, feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
      <Text style={[styles.feedbackText, feedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{feedback.message}</Text>
    </View>
  );
}

function ProfileLine({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.profileLine, last && styles.profileLineLast]}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#070911' },
  loadingText: { color: '#858B9E', fontSize: 12 },
  sky: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  glow: { position: 'absolute', top: 110, left: '50%', width: 360, height: 360, marginLeft: -180, borderRadius: 180, backgroundColor: 'rgba(126,96,190,0.055)' },
  star: { position: 'absolute', borderRadius: 9, backgroundColor: '#FFFFFF' },
  starOne: { top: '14%', left: '11%', width: 2, height: 2, opacity: 0.5 },
  starTwo: { top: '26%', right: '14%', width: 3, height: 3, opacity: 0.62 },
  starThree: { top: '52%', left: '7%', width: 2, height: 2, opacity: 0.3 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F5F3FF', fontSize: 17, fontWeight: '800', letterSpacing: 3.2 },
  securePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: '#101420' },
  secureDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#7FE0B6' },
  secureText: { color: '#858B9E', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', paddingTop: 12 },
  title: { maxWidth: 400, color: '#F5F3FA', fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center', letterSpacing: -0.7 },
  subtitle: { maxWidth: 370, color: '#A7B0C5', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  segment: { width: '100%', flexDirection: 'row', padding: 4, marginTop: 25, borderRadius: 16, backgroundColor: '#0E121C' },
  socialGroup: { width: '100%', gap: 9, marginTop: 24 },
  socialButton: { width: '100%', height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderRadius: 15, backgroundColor: '#111622', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  socialMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  googleMark: { backgroundColor: '#F7F7FA' },
  googleMarkText: { color: '#4285F4', fontSize: 14, fontWeight: '900' },
  appleMark: { backgroundColor: '#F7F7FA' },
  appleMarkText: { color: '#0B0D12', fontSize: 13, fontWeight: '900' },
  socialButtonText: { flex: 1, color: '#E8E4EE', fontSize: 12, fontWeight: '800', marginLeft: 12 },
  socialChevron: { color: '#777F91', fontSize: 22 },
  dividerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.075)' },
  dividerText: { color: '#A1A9BB', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  segmentButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segmentButtonActive: { backgroundColor: '#24283A' },
  segmentText: { color: '#737A8D', fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#F0ECF8' },
  formCard: { width: '100%', gap: 13, padding: 16, marginTop: 12, borderRadius: 20, backgroundColor: '#0E121C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.065)' },
  nameRow: { width: '100%', flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 7 },
  fieldLabel: { color: '#8881A0', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  input: { width: '100%', minWidth: 0, height: 50, paddingHorizontal: 13, borderRadius: 13, color: '#F3F0F8', fontSize: 16, backgroundColor: '#151A27', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  primaryButton: { width: '100%', minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 18, borderRadius: 15, backgroundColor: '#C8BAF5' },
  primaryButtonText: { color: '#171321', fontSize: 12, fontWeight: '900' },
  buttonArrow: { color: '#171321', fontSize: 19 },
  buttonDisabled: { opacity: 0.7 },
  feedback: { width: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  feedbackSuccess: { backgroundColor: 'rgba(47,118,88,0.16)', borderColor: 'rgba(127,224,182,0.28)' },
  feedbackError: { backgroundColor: 'rgba(134,57,72,0.15)', borderColor: 'rgba(226,167,178,0.28)' },
  feedbackText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  feedbackSuccessText: { color: '#A9F1D1' },
  feedbackErrorText: { color: '#EAB4BE' },
  avatarScene: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  avatarOrbit: { position: 'absolute', width: 122, height: 62, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(133,177,255,0.2)', transform: [{ rotate: '-18deg' }] },
  avatarBadge: { position: 'absolute', right: 6, bottom: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#171D2B', borderWidth: 1, borderColor: 'rgba(188,208,255,0.26)' },
  avatarText: { color: '#DFE9FF', fontSize: 13, fontWeight: '900' },
  guestScene: { width: 124, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: -20, marginBottom: 8 },
  guestOrbit: { position: 'absolute', width: 122, height: 54, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(137,167,230,0.18)', transform: [{ rotate: '18deg' }] },
  profileLoader: { marginTop: 32 },
  profileCard: { width: '100%', paddingHorizontal: 16, marginTop: 25, marginBottom: 12, borderRadius: 20, backgroundColor: '#0E121C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.065)' },
  profileLine: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.065)' },
  profileLineLast: { borderBottomWidth: 0 },
  profileLabel: { color: '#747C90', fontSize: 12 },
  profileValue: { flex: 1, color: '#E9E5F0', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  editActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#171C2A' },
  secondaryButtonText: { color: '#CBC6D4', fontSize: 12, fontWeight: '800' },
  signOutButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 9 },
  signOutText: { color: '#A39AAA', fontSize: 12, fontWeight: '700' },
});
