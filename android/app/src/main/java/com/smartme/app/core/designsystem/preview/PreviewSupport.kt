package com.smartme.app.core.designsystem.preview

import android.content.res.Configuration
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.smartme.app.core.designsystem.theme.SmartMeTheme

/**
 * Standard preview pair for a screen: a phone-sized light variant and the same
 * composition in dark mode. Apply this to every `@Composable` preview instead of
 * hand-writing two `@Preview` annotations.
 */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.BINARY)
@Preview(name = "Light", showBackground = true, widthDp = 411, heightDp = 891)
@Preview(
    name = "Dark",
    showBackground = true,
    widthDp = 411,
    heightDp = 891,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
annotation class ScreenPreviews

/**
 * Applies the real SmartMe theme and an opaque app background, so previews match
 * the running app in both colour schemes (and never sit on Studio's default
 * white canvas).
 */
@Composable
internal fun PreviewContainer(content: @Composable () -> Unit) {
    SmartMeTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
            content()
        }
    }
}
