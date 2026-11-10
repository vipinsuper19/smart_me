package com.smartme.app.feature.learning

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.WorkOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp

/**
 * Colour and icon pairing for a learning path. Home and the path roadmap both
 * read from this map so a subject keeps the same visual identity everywhere.
 */
data class PathVisual(
    val icon: ImageVector,
    val container: Color,
    val content: Color,
)

@Composable
fun pathVisual(slug: String): PathVisual {
    val scheme = MaterialTheme.colorScheme
    return when (slug) {
        "english-communication" -> PathVisual(
            icon = Icons.Outlined.ChatBubbleOutline,
            container = scheme.primaryContainer,
            content = scheme.onPrimaryContainer,
        )

        "career-workplace-skills" -> PathVisual(
            icon = Icons.Outlined.WorkOutline,
            container = scheme.secondaryContainer,
            content = scheme.onSecondaryContainer,
        )

        "financial-literacy" -> PathVisual(
            icon = Icons.Outlined.Savings,
            container = scheme.tertiaryContainer,
            content = scheme.onTertiaryContainer,
        )

        else -> PathVisual(
            icon = Icons.Outlined.School,
            container = scheme.surfaceVariant,
            content = scheme.onSurfaceVariant,
        )
    }
}

/** Rounded subject tile used by the home grid, continue card and path hero. */
@Composable
fun PathIconTile(
    slug: String,
    size: Dp,
    iconSize: Dp,
    modifier: Modifier = Modifier,
    containerColor: Color? = null,
    contentColor: Color? = null,
) {
    val visual = pathVisual(slug)
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size / 3.5f))
            .background(containerColor ?: visual.container),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = visual.icon,
            contentDescription = null,
            tint = contentColor ?: visual.content,
            modifier = Modifier.size(iconSize),
        )
    }
}
