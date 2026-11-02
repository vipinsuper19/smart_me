package com.smartme.app.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * The five styles from the design spec, expressed in the Material 3 slots the
 * screens already use:
 *
 *  - H1 Large Title   28 / Bold   -> display*
 *  - H2 Section Title 22 / Semibold -> headline*
 *  - H3 Card Title    18 / Semibold -> titleLarge/Medium
 *  - Body             16 / Regular -> body*, labelLarge
 *  - Caption          14 / Regular -> bodySmall, labelMedium
 *
 * SmartMe uses the platform font rather than a downloadable Google font: the app
 * must render instantly on first launch and on low-end devices, and a network
 * font fetch would block the first frame.
 */
private fun TextStyle.h1() = copy(
    fontFamily = FontFamily.Default,
    fontWeight = FontWeight.Bold,
    fontSize = 28.sp,
    lineHeight = 36.sp,
    letterSpacing = 0.sp,
)

private fun TextStyle.h2() = copy(
    fontFamily = FontFamily.Default,
    fontWeight = FontWeight.SemiBold,
    fontSize = 22.sp,
    lineHeight = 28.sp,
    letterSpacing = 0.sp,
)

private fun TextStyle.h3() = copy(
    fontFamily = FontFamily.Default,
    fontWeight = FontWeight.SemiBold,
    fontSize = 18.sp,
    lineHeight = 24.sp,
    letterSpacing = 0.sp,
)

private fun TextStyle.body() = copy(
    fontFamily = FontFamily.Default,
    fontWeight = FontWeight.Normal,
    fontSize = 16.sp,
    lineHeight = 24.sp,
    letterSpacing = 0.sp,
)

private fun TextStyle.caption() = copy(
    fontFamily = FontFamily.Default,
    fontWeight = FontWeight.Normal,
    fontSize = 14.sp,
    lineHeight = 20.sp,
    letterSpacing = 0.sp,
)

private val h1 = TextStyle.Default.h1()
private val h2 = TextStyle.Default.h2()
private val h3 = TextStyle.Default.h3()
private val body = TextStyle.Default.body()
private val caption = TextStyle.Default.caption()

val SmartMeTypography = Typography(
    displayLarge = h1,
    displayMedium = h1,
    displaySmall = h1,
    headlineLarge = h2,
    headlineMedium = h2,
    headlineSmall = h2,
    titleLarge = h3,
    titleMedium = h3,
    titleSmall = h3.copy(fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = body,
    bodyMedium = body,
    bodySmall = caption,
    labelLarge = body.copy(fontWeight = FontWeight.SemiBold),
    labelMedium = caption.copy(fontWeight = FontWeight.Medium),
    labelSmall = caption.copy(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
)
