package com.smartme.app.core.designsystem.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// SmartMe design tokens (docs reference: palette card).
//
// Primary   #2563EB   Secondary #10B981   Accent #F59E0B   Error #EF4444
// Neutrals  #111827 · #374151 · #6B7280 · #9CA3AF · #E5E7EB · #F3F4F6 · #FFFFFF
//
// Primary drives actions and selection, green is positive feedback, and the
// amber accent doubles as the XP reward colour.

private val Blue600 = Color(0xFF2563EB)
private val Blue900 = Color(0xFF1E3A8A)
private val Blue100 = Color(0xFFDBEAFE)
private val Blue300 = Color(0xFF93C5FD)
private val Blue700 = Color(0xFF1D4ED8)

private val Green500 = Color(0xFF10B981)
private val Green800 = Color(0xFF064E3B)
private val Green100 = Color(0xFFD1FAE5)
private val Green300 = Color(0xFF6EE7B7)
private val Green700 = Color(0xFF047857)

private val Amber500 = Color(0xFFF59E0B)
private val Amber900 = Color(0xFF78350F)
private val Amber100 = Color(0xFFFEF3C7)
private val Amber300 = Color(0xFFFCD34D)
private val Amber700 = Color(0xFFB45309)

private val Red500 = Color(0xFFEF4444)
private val Red900 = Color(0xFF7F1D1D)
private val Red100 = Color(0xFFFEE2E2)
private val Red300 = Color(0xFFFCA5A5)
private val Red700 = Color(0xFFB91C1C)

private val Ink = Color(0xFF111827)
private val InkSoft = Color(0xFF374151)
private val Grey = Color(0xFF6B7280)
private val GreyMid = Color(0xFF9CA3AF)
private val GreyLine = Color(0xFFE5E7EB)
private val GreySurface = Color(0xFFF3F4F6)
private val White = Color(0xFFFFFFFF)

internal val LightColorScheme = lightColorScheme(
    primary = Blue600,
    onPrimary = White,
    primaryContainer = Blue100,
    onPrimaryContainer = Blue900,
    secondary = Green500,
    onSecondary = Green800,
    secondaryContainer = Green100,
    onSecondaryContainer = Green800,
    tertiary = Amber500,
    onTertiary = Ink,
    tertiaryContainer = Amber100,
    onTertiaryContainer = Amber900,
    error = Red500,
    onError = White,
    errorContainer = Red100,
    onErrorContainer = Red900,
    background = GreySurface,
    onBackground = Ink,
    surface = White,
    onSurface = Ink,
    surfaceVariant = GreySurface,
    onSurfaceVariant = Grey,
    outline = GreyMid,
    outlineVariant = GreyLine,
    scrim = Color(0xFF000000),
    inverseSurface = Ink,
    inverseOnSurface = GreySurface,
    inversePrimary = Blue300,
    surfaceDim = GreyLine,
    surfaceBright = White,
    surfaceContainerLowest = White,
    surfaceContainerLow = Color(0xFFF9FAFB),
    surfaceContainer = GreySurface,
    surfaceContainerHigh = GreyLine,
    surfaceContainerHighest = Color(0xFFD1D5DB),
)

internal val DarkColorScheme = darkColorScheme(
    primary = Blue300,
    onPrimary = Blue900,
    primaryContainer = Blue700,
    onPrimaryContainer = Blue100,
    secondary = Green300,
    onSecondary = Green800,
    secondaryContainer = Green700,
    onSecondaryContainer = Green100,
    tertiary = Amber300,
    onTertiary = Amber900,
    tertiaryContainer = Amber700,
    onTertiaryContainer = Amber100,
    error = Red300,
    onError = Red900,
    errorContainer = Red700,
    onErrorContainer = Red100,
    background = Color(0xFF0B1120),
    onBackground = Color(0xFFE5E7EB),
    surface = Color(0xFF0B1120),
    onSurface = Color(0xFFE5E7EB),
    surfaceVariant = Color(0xFF1F2937),
    onSurfaceVariant = GreyMid,
    outline = Color(0xFF4B5563),
    outlineVariant = InkSoft,
    scrim = Color(0xFF000000),
    inverseSurface = Color(0xFFE5E7EB),
    inverseOnSurface = Ink,
    inversePrimary = Blue600,
    surfaceDim = Color(0xFF0B1120),
    surfaceBright = Color(0xFF1F2937),
    surfaceContainerLowest = Color(0xFF070B14),
    surfaceContainerLow = Ink,
    surfaceContainer = Color(0xFF161E2E),
    surfaceContainerHigh = Color(0xFF1F2937),
    surfaceContainerHighest = Color(0xFF2B3648),
)

/**
 * Colours outside the Material 3 roles: XP, streaks and success feedback.
 *
 * Amber is the accent, so XP borrows it directly; streaks stay warm orange and
 * success stays green so the three rewards never read as the same signal.
 */
data class SmartMeColors(
    val xp: Color,
    val onXp: Color,
    val xpContainer: Color,
    val onXpContainer: Color,
    val streak: Color,
    val onStreak: Color,
    val streakContainer: Color,
    val onStreakContainer: Color,
    val success: Color,
    val onSuccess: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
)

internal val LightSmartMeColors = SmartMeColors(
    xp = Amber700,
    onXp = White,
    xpContainer = Amber100,
    onXpContainer = Amber900,
    streak = Color(0xFFC2410C),
    onStreak = White,
    streakContainer = Color(0xFFFFEDD5),
    onStreakContainer = Color(0xFF7C2D12),
    success = Color(0xFF059669),
    onSuccess = White,
    successContainer = Green100,
    onSuccessContainer = Green800,
)

internal val DarkSmartMeColors = SmartMeColors(
    xp = Amber300,
    onXp = Amber900,
    xpContainer = Color(0xFF92400E),
    onXpContainer = Amber100,
    streak = Color(0xFFFDBA74),
    onStreak = Color(0xFF7C2D12),
    streakContainer = Color(0xFF9A3412),
    onStreakContainer = Color(0xFFFFEDD5),
    success = Green300,
    onSuccess = Green800,
    successContainer = Green700,
    onSuccessContainer = Green100,
)
