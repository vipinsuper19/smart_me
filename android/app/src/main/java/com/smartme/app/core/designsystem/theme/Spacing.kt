package com.smartme.app.core.designsystem.theme

import androidx.compose.ui.unit.dp

/**
 * A 4 dp spacing scale. Screens should compose these instead of ad-hoc `dp`
 * values so layout rhythm stays consistent as features are added.
 */
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp

    /** Horizontal margin used by every full-screen surface. */
    val screen = 20.dp

    /** Minimum touch target, matching the Material 3 accessibility guidance. */
    val minTouchTarget = 48.dp
}
