# SmartMe — Android app

Kotlin + Jetpack Compose client for SmartMe, built on the same REST API as the
admin panel (`/api/v1`).

## Requirements

| Tool | Version |
|---|---|
| JDK | 21 |
| Android SDK | API 37 (`compileSdk` / `targetSdk`), build-tools installed by AGP |
| Gradle | 9.7.1 via the wrapper |
| AGP | 9.5.0 |
| Kotlin | 2.4.21 |

`local.properties` must point at your SDK:

```properties
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```

The first build needs internet access to resolve Gradle and Maven artifacts.

Google Sign-In is optional. To enable it, provide the **Web application** OAuth
client ID from the same Google Cloud project as the backend's `GOOGLE_CLIENT_ID`:

```properties
# android/local.properties (never committed) or ~/.gradle/gradle.properties
SMARTME_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

`app/build.gradle.kts` reads it as the `SMARTME_GOOGLE_WEB_CLIENT_ID` Gradle
property and exposes it as `BuildConfig.GOOGLE_WEB_CLIENT_ID`. When the value is
blank (the default) the "Continue with Google" button is hidden and email auth
still works, so local builds need no Google configuration.

## Build and test

```powershell
cd android
.\gradlew.bat :app:assembleDebug      # debug APK
.\gradlew.bat :app:testDebugUnitTest  # JVM unit tests
.\gradlew.bat :app:lintDebug          # Android lint
.\gradlew.bat :app:installDebug       # install on a running emulator/device
.\gradlew.bat :app:connectedDebugAndroidTest  # instrumented UI tests on a device
```

The debug APK output is `app/build/outputs/apk/debug/app-debug.apk`. Lint expects
zero errors; the only remaining warnings are "newer version available" notices
for Gradle and OkHttp, which are upgraded deliberately rather than automatically.

Instrumented tests live in `app/src/androidTest` and drive the real app with
Compose semantics (no Hilt overrides, no backend): they cover the signed-out
launch, the "Create your account" chooser and both email paths into the
registration form.

### CI

`.github/workflows/ci.yml` runs backend/admin lint, typecheck, tests and build
plus Android unit tests and lint on every push and pull request.
`.github/workflows/android-instrumented.yml` runs the Compose UI tests on an
API 36 `google_apis` x86_64 emulator on GitHub-hosted Linux, using `/dev/kvm`
for hardware acceleration, and uploads the HTML report and test results as an
artifact. It also has a manual `workflow_dispatch` trigger.

## Backend endpoint

`API_BASE_URL` is a `BuildConfig` field set per build type in `app/build.gradle.kts`:

| Build type | Value |
|---|---|
| `debug` | `http://10.0.2.2:3001/api/v1/` (emulator loopback to the host) |
| `release` | `https://api.smartme.app/api/v1/` (placeholder until deployed) |

The debug URL can be overridden for a physical device. Run the backend on the
host, forward the port over USB, and pass the property at build time:

```powershell
adb reverse tcp:3001 tcp:3001
.\gradlew.bat :app:installDebug -PSMARTME_API_BASE_URL=http://127.0.0.1:3001/api/v1/
```

`127.0.0.1` is already allowed by the debug network security config.

Debug builds add `src/debug/res/xml/network_security_config.xml`, which permits
cleartext HTTP only for `10.0.2.2`, `localhost` and `127.0.0.1`. Release builds
inherit Android's HTTPS-only default, so the placeholder URL must be replaced
with a real HTTPS host before shipping.

Start the backend from the repository root with `pnpm dev:backend`; it listens on
port 3001.

## Module layout

```
app/src/main/java/com/smartme/app/
├─ MainActivity.kt, SmartMeApplication.kt, AppViewModel.kt
├─ core/
│  ├─ designsystem/   theme (colour, type, shape, spacing) + shared components
│  ├─ model/          UiState, UserSummary
│  ├─ network/        Retrofit API, ApiExecutor, ApiErrorMapper, AuthInterceptor
│  ├─ security/       TokenStore, Keystore cipher, DataStore persistence
│  └─ connectivity/   NetworkMonitor
├─ data/
│  ├─ auth/           AuthRepository, token/user mappers, SessionPreferences,
│  │                  DefaultSessionRefresher
│  └─ onboarding/     OnboardingRepository, in-memory draft store, option lists
├─ di/                Hilt modules (DataStore, security, network, auth, connectivity)
├─ navigation/        routes, auth graph, bottom bar, tab graph, app shell
└─ feature/
   ├─ session/        SessionViewModel + gate states
   ├─ splash/         branded launch screen shown while the session restores
   ├─ auth/           welcome, create account, sign-in, register, Google client,
   │                  form components
   ├─ onboarding/     five-step wizard (pre-auth and post-auth)
   ├─ profile/        account summary + sign-out
   └─ home, explore, practice, progress
```

Feature code depends on `core` and `data`; `core` never depends on `feature`. New
API endpoints are added to `SmartMeApi` (or `AuthApi`), and their failures are
already converted to `ApiError` by `ApiExecutor`, so screens only render
`UiState` or a screen-specific form state.

## What Task 12 delivers

- Material 3 theme built from the design-spec tokens: primary `#2563EB`,
  secondary `#10B981`, accent `#F59E0B`, error `#EF4444`, the `#111827`–`#F3F4F6`
  neutral ramp, a five-step type scale (28 bold / 22 semibold / 18 semibold /
  16 regular / 14 regular) and 6–24 dp corner radii. Light and dark schemes are
  hand-built (dynamic colour is off by default); XP, streak and success tokens
  live in `SmartMeTheme.colors`.
- The SmartMe brand mark (`drawable/ic_splash_mark.xml`) is used on the splash
  screen, and the same vector is the adaptive launcher icon on a white tile
  (`ic_launcher_foreground.xml` + `ic_launcher_background.xml`).
- Five-tab shell (Home, Explore, Practice, Progress, Profile) with state-preserving
  bottom navigation.
- Network layer: OkHttp 5, Retrofit 3, kotlinx.serialization, bearer-token
  interceptor, timeout policy and release-safe logging.
- Encrypted session storage: AES-256/GCM key in the Android Keystore, ciphertext
  in a separate DataStore file, decrypted tokens held in memory only.
- Connectivity monitor with an offline banner, and shared loading / empty / error
  components.
- Home tab with a time-based greeting and a live backend health card exercising
  the network and state layers end to end.
- Unit tests for error mapping, token lifecycle and the greeting rule.

## What Task 13 delivers

- **Session gate.** `SessionViewModel` decides between `Restoring`, `SignedOut`
  (welcome/auth graph), `NeedsOnboarding` and `Ready` (five-tab shell), so no tab
  screen ever has to know whether a learner is signed in.
- **Welcome, provider chooser, sign-in and registration screens** with
  client-side validation that mirrors the API rules (8–128 characters, at least
  one letter and one number, matching confirmation, terms/privacy consent).
  "Create your account" offers Google and email; the email paths open the full
  registration form. Phone sign-up is omitted because phone OTP is not part of
  the MVP.
- **Google Sign-In** through Credential Manager. If the backend reports
  `TERMS_ACCEPTANCE_REQUIRED` for a brand-new Google identity, a consent dialog
  collects agreement and retries with the same ID token.
- **Onboarding wizard** with the five PRD questions (goal, proficiency,
  explanation language, daily goal, interests). It runs before registration —
  collecting the draft in memory — or after sign-in for an account that has not
  finished onboarding, where it saves directly.
- **Refresh rotation and 401 recovery** in `AuthInterceptor` and
  `DefaultSessionRefresher` (see below).
- **Profile tab** with the signed-in name/email and a sign-out action.
- Unit tests for auth validation, token/user mapping, interceptor refresh
  behaviour and single-flight refresh (45 tests across 7 suites).

## Splash, welcome, onboarding and account-creation design pass

The launch experience follows the supplied splash reference;
`docs/onboarding_flow.png` covers welcome and onboarding.

- **Launch window.** `Theme.SmartMe` shows `@drawable/splash_background` (the
  app background plus the brand mark) on Android 11 and below, and on Android 12+
  a transparent `windowSplashScreenAnimatedIcon` on the same background, so the
  platform splash never cross-fades a second, differently sized logo.
- **Branded splash.** `feature/splash/SplashScreen.kt` renders while
  `SessionState.Restoring`: `ic_splash_mark` (the book mark without a tile) above
  a 46 sp bold wordmark and the "Small Lessons. Big Futures." tagline, 9 % above
  the vertical centre, with soft blue blobs bleeding out of the top-right and
  bottom-left corners and a 34 dp spinner low on the screen (tracked ring, 18 %
  primary track). The spinner fades in after 400 ms, and `SessionViewModel` holds
  the first resolved state for at least 900 ms so a fast restore cannot flash
  past the brand.
- **Mark assets.** `ic_splash_mark.xml` is the tile-less mark used by the splash
  and the launch window; `ic_splash_transparent.xml` keeps the Android 12+ system
  splash icon invisible; `ic_launcher_foreground.xml` holds the same geometry
  scaled into the adaptive-icon safe zone on a white background.
- **Welcome.** The kid illustration (`drawable-nodpi/welcome_avatar.png`) sits
  above the headline, tagline and the primary "Get Started →" action, with a
  text button for existing accounts. The source artwork's white canvas was
  flood-filled to transparency so it floats on the dark theme instead of showing
  a bright square.
- **Create account.** `feature/auth/createaccount/CreateAccountScreen.kt` is the
  provider chooser: 28 sp title, two-line subtitle, pill-shaped outlined rows
  for Google and email, an "or" divider, a pill primary "Sign Up with Email"
  action and a pinned "Already have an account? Login" footer. Continue with
  Email and Sign Up with Email both open the existing registration form; Google
  reuses the same consent-dialog flow as sign-in.
- **Onboarding.** One question per step with a back arrow, a thin progress bar
  and an "n of 5" counter. Options are icon-led cards with a supporting line and
  a trailing check/ring; interests use a two-column tile grid. The selected fill
  is a low-alpha blue tint so it stays subtle in both themes, and there is no
  "Skip" action — the design has none.

## Iconography

Material icons (`androidx.compose.material:material-icons-extended`) are used
wherever a symbol reads faster than text: bottom navigation (filled for the
selected tab, outlined otherwise), auth field leading icons (person, mail, lock),
onboarding option icons (translate, work, trending, target, language, bolt,
topics), Home status (`CloudDone`) and plan/rewards cards
(`CalendarMonth`, `LocalFireDepartment`), Profile preferences (`Tune`) and the
shared loading/empty/error views. AutoMirrored variants are used for directional
icons so RTL layouts stay correct.

## Session lifecycle

- On launch `TokenStore.restore()` decrypts the saved session before the first
  request can fire.
- `onboarding_completed` is cached in DataStore, so a cold start opens the right
  shell immediately and refreshes the learner from `GET /auth/me` in the
  background. With no cached value, the gate waits for `/auth/me`, which also
  picks up onboarding completed on another device.
- `AuthInterceptor` attaches the bearer token. When the stored access token is
  already expired (including the 30 s skew) it refreshes **before** sending;
  when the API still answers `401` it refreshes once and replays the request.
  The original response is returned if recovery fails, so callers see a normal
  `UNAUTHORIZED` `ApiError` instead of an exception.
- `DefaultSessionRefresher` is single-flight: concurrent requests share one
  `/auth/refresh` call. Rotation replaces both tokens; a rejected refresh token
  clears the session, while a transport failure leaves it intact for a retry.
- Sign-out clears the local session first, then revokes the refresh token
  best-effort, so a network failure cannot keep the learner signed in.
- Choices collected before sign-up are submitted automatically once the account
  exists. If that submission fails, the post-auth wizard reappears with the
  draft intact. A draft collected for a different account is discarded when that
  account has already completed onboarding.

## Deliberately not included yet

- Learning, quiz and progress features (Tasks 14–15) — those tabs are placeholders.
- Editable profile fields and learning-preference editing (Tasks 14–15).
- Password reset and email verification screens.
- Firebase / push notifications (Task 15).

## Storage and backup

Session tokens are encrypted with a Keystore key that never leaves the device.
`res/xml/backup_rules.xml` and `res/xml/data_extraction_rules.xml` exclude
`datastore/smartme_tokens.preferences_pb` from cloud backup and device transfer,
because restored ciphertext cannot be decrypted by another device's key.

## Conventions

- All user-visible text lives in `res/values/strings.xml`.
- Screens render `UiState` through the shared state components instead of local
  booleans.
- Do not commit `build/`, `.gradle/` or `local.properties`.
