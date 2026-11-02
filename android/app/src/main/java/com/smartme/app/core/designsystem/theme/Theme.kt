package com.smartme.app.core.designsystem.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

val LocalSmartMeColors = staticCompositionLocalOf { LightSmartMeColors }

@Composable
fun SmartMeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val smartMeColors = if (darkTheme) DarkSmartMeColors else LightSmartMeColors

    CompositionLocalProvider(LocalSmartMeColors provides smartMeColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = SmartMeTypography,
            shapes = SmartMeShapes,
            content = content,
        )
    }
}

/** Access point for the SmartMe palette entries that Material 3 does not model. */
object SmartMeTheme {
    val colors: SmartMeColors
        @Composable
        @ReadOnlyComposable
        get() = LocalSmartMeColors.current
}
