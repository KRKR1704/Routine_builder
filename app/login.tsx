import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppButton from "../components/AppButton";
import FormField from "../components/FormField";
import { Colors } from "../constants/colors";
import { FontSize, Radius, Spacing } from "../constants/theme";
import { useUser } from "../contexts/UserContext";
import { ApiError } from "../utils/api";

type Tab = "login" | "register";

export default function LoginScreen() {
  const { loginAsDemo, register, loginUser, isAuthenticated, onboardingDone } =
    useUser();

  const [tab, setTab] = useState<Tab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      if (onboardingDone) {
        router.replace("/(tabs)/today");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [isAuthenticated, onboardingDone]);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      await loginUser(email.trim().toLowerCase(), password);
      // UserContext sets onboardingDone=true for returning users
      router.replace("/(tabs)/today");
    } catch (e) {
      setError(e instanceof ApiError ? "Invalid email or password." : "Login failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace("/onboarding");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? "That email is already registered."
          : "Registration failed. Check your connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginAsDemo();
      router.replace("/onboarding");
    } catch (e) {
      setError("Could not connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoBox}>
              <Ionicons name="refresh-circle" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>Recovery Planner</Text>
            <Text style={styles.tagline}>
              Plan your day. Recover when it goes wrong.
            </Text>
          </View>

          {/* Tab switcher */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === "login" && styles.tabActive]}
              onPress={() => { setTab("login"); setError(null); }}
            >
              <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === "register" && styles.tabActive]}
              onPress={() => { setTab("register"); setError(null); }}
            >
              <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {tab === "register" && (
              <FormField
                label="Display Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
              />
            )}
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={tab === "register" ? "At least 6 characters" : "Your password"}
              secureTextEntry
            />

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.delayed} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={{ marginTop: Spacing.lg }}>
              {loading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <AppButton
                  label={tab === "login" ? "Sign In" : "Create Account"}
                  onPress={tab === "login" ? handleLogin : handleRegister}
                  disabled={
                    tab === "login"
                      ? !email.trim() || !password
                      : !name.trim() || !email.trim() || !password
                  }
                  size="large"
                />
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Demo */}
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={handleDemo}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Ionicons name="flask-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.demoBtnText}>Continue with Demo Account</Text>
          </TouchableOpacity>
          <Text style={styles.demoHint}>
            Try the app instantly — no account needed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: { alignItems: "center", paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  tabActive: { backgroundColor: Colors.card },
  tabText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textMuted },
  tabTextActive: { color: Colors.textPrimary },
  form: { gap: 0 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: Colors.delayedBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.delayedBorder,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.delayed, flex: 1 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  demoBtnText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "500" },
  demoHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
