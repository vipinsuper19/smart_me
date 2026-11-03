package com.smartme.app.feature.lesson

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import coil3.compose.AsyncImage
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.network.LessonBlockDto
import kotlinx.coroutines.delay
import kotlin.math.max

/**
 * Renders one structured lesson block. Unknown types are skipped: the backend
 * already filters unsupported values, and a future server-side type must never
 * crash an older client (docs/CONTENT-MODEL.md §3).
 */
@Composable
internal fun LessonBlockContent(block: LessonBlockDto, modifier: Modifier = Modifier) {
    when (block.type.uppercase()) {
        "HEADING" -> HeadingBlock(text = block.payload.text("text").orEmpty(), modifier = modifier)
        "PARAGRAPH" -> ParagraphBlock(text = block.payload.text("text").orEmpty(), modifier = modifier)
        "BULLET_LIST" -> BulletListBlock(items = block.payload.textList("items"), modifier = modifier)
        "CALLOUT" -> CalloutBlock(block = block, modifier = modifier)
        "EXAMPLE_CONVERSATION" -> ConversationBlock(block = block, modifier = modifier)
        "RECAP" -> RecapBlock(items = block.payload.textList("items"), modifier = modifier)
        "IMAGE" -> ImageBlock(block = block, modifier = modifier)
        "AUDIO" -> AudioBlock(block = block, modifier = modifier)
        "VIDEO" -> VideoBlock(block = block, modifier = modifier)
        "MULTIPLE_CHOICE", "TRUE_FALSE" -> KnowledgeCheckBlock(block = block, modifier = modifier)
        "COMPLETION" -> CompletionBlock(block = block, modifier = modifier)
        else -> Unit
    }
}

@Composable
private fun HeadingBlock(text: String, modifier: Modifier = Modifier) {
    if (text.isBlank()) return
    Text(
        text = text,
        modifier = modifier.fillMaxWidth(),
        style = MaterialTheme.typography.headlineSmall,
        color = MaterialTheme.colorScheme.onSurface,
    )
}

@Composable
private fun ParagraphBlock(text: String, modifier: Modifier = Modifier) {
    if (text.isBlank()) return
    Text(
        text = text,
        modifier = modifier.fillMaxWidth(),
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurface,
    )
}

@Composable
private fun BulletListBlock(items: List<String>, modifier: Modifier = Modifier) {
    if (items.isEmpty()) return
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        items.forEach { item ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    text = "•",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = item,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun CalloutBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val title = block.payload.text("title").orEmpty()
    val text = block.payload.text("text").orEmpty()
    if (title.isBlank() && text.isBlank()) return
    val hinglish = block.payload.text("language")?.equals("HINGLISH", ignoreCase = true) == true

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (hinglish) {
                MaterialTheme.colorScheme.tertiaryContainer
            } else {
                MaterialTheme.colorScheme.primaryContainer
            },
        ),
    ) {
        Row(
            modifier = Modifier.padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Icon(
                imageVector = Icons.Outlined.Lightbulb,
                contentDescription = null,
                tint = if (hinglish) {
                    MaterialTheme.colorScheme.onTertiaryContainer
                } else {
                    MaterialTheme.colorScheme.onPrimaryContainer
                },
                modifier = Modifier.size(22.dp),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs),
            ) {
                Text(
                    text = title.ifBlank { stringResource(R.string.lesson_callout_default_title) },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (hinglish) {
                        MaterialTheme.colorScheme.onTertiaryContainer
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    },
                )
                if (text.isNotBlank()) {
                    Text(
                        text = text,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (hinglish) {
                            MaterialTheme.colorScheme.onTertiaryContainer
                        } else {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ConversationBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val lines = block.payload.conversationLines()
    if (lines.isEmpty()) return

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Forum,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = block.caption ?: stringResource(R.string.lesson_conversation),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            lines.forEach { line ->
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (line.speaker.isNotBlank()) {
                        Text(
                            text = line.speaker,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Text(
                        text = line.text,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun RecapBlock(items: List<String>, modifier: Modifier = Modifier) {
    if (items.isEmpty()) return

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
        ),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Checklist,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = stringResource(R.string.lesson_recap),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
            items.forEach { item ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.Top,
                ) {
                    Text(
                        text = "•",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                    Text(
                        text = item,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }
        }
    }
}

@Composable
private fun ImageBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val url = block.media?.url ?: block.payload.text("url")
    val description = block.media?.altText ?: block.payload.text("alt") ?: block.caption

    if (url.isNullOrBlank()) {
        MediaUnavailable(
            icon = Icons.Outlined.Image,
            message = stringResource(R.string.lesson_image_error),
            modifier = modifier,
        )
        return
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 160.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.Image,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
            AsyncImage(
                model = url,
                contentDescription = description,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (!block.caption.isNullOrBlank()) {
            Text(
                text = block.caption,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Suppress("LongMethod")
@Composable
private fun AudioBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val url = block.media?.url ?: block.payload.text("url")
    val transcript = block.payload.text("transcript")
    val controller = rememberAudioController(url)
    var showTranscript by remember { mutableStateOf(false) }

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.GraphicEq,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = block.caption ?: stringResource(R.string.lesson_audio_title),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = formatTime(controller.positionMs) +
                            " / " +
                            formatTime(controller.durationMs),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(
                    onClick = controller::toggle,
                    enabled = controller.isPrepared && !controller.error,
                ) {
                    Icon(
                        imageVector = if (controller.isPlaying) {
                            Icons.Outlined.Pause
                        } else {
                            Icons.Outlined.PlayArrow
                        },
                        contentDescription = stringResource(
                            if (controller.isPlaying) {
                                R.string.lesson_audio_pause
                            } else {
                                R.string.lesson_audio_play
                            },
                        ),
                    )
                }
                IconButton(
                    onClick = controller::stop,
                    enabled = controller.isPrepared && !controller.error,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Stop,
                        contentDescription = stringResource(R.string.lesson_audio_stop),
                    )
                }
            }

            when {
                url.isNullOrBlank() || controller.error -> {
                    Text(
                        text = stringResource(R.string.lesson_audio_error),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                    TextButton(onClick = controller::retry, enabled = !url.isNullOrBlank()) {
                        Text(text = stringResource(R.string.lesson_audio_retry))
                    }
                }

                !controller.isPrepared -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                        )
                        Text(
                            text = stringResource(R.string.lesson_audio_play),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                else -> {
                    Slider(
                        value = controller.positionMs.toFloat()
                            .coerceIn(0f, max(controller.durationMs, 1).toFloat()),
                        onValueChange = { controller.seekTo(it.toInt()) },
                        valueRange = 0f..max(controller.durationMs, 1).toFloat(),
                        enabled = controller.durationMs > 0,
                    )
                }
            }

            if (!transcript.isNullOrBlank()) {
                TextButton(onClick = { showTranscript = !showTranscript }) {
                    Text(
                        text = stringResource(
                            if (showTranscript) {
                                R.string.lesson_audio_hide_transcript
                            } else {
                                R.string.lesson_audio_show_transcript
                            },
                        ),
                    )
                }
                if (showTranscript) {
                    Text(
                        text = transcript,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun VideoBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val url = block.media?.url ?: block.payload.text("url")
    if (url.isNullOrBlank()) {
        MediaUnavailable(
            icon = Icons.Outlined.Videocam,
            message = stringResource(R.string.lesson_video_error),
            modifier = modifier,
        )
        return
    }

    val context = LocalContext.current
    var failed by remember(url) { mutableStateOf(false) }
    val videoView = remember { mutableStateOf<VideoView?>(null) }

    DisposableEffect(url) {
        onDispose { videoView.value?.stopPlayback() }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.Black),
        ) {
            AndroidView(
                factory = { ctx ->
                    VideoView(ctx).apply {
                        setVideoURI(url.toUri())
                        setMediaController(
                            MediaController(ctx).also { controller ->
                                controller.setAnchorView(this)
                            },
                        )
                        setOnErrorListener { _, _, _ ->
                            failed = true
                            true
                        }
                        videoView.value = this
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
            if (failed) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = stringResource(R.string.lesson_video_error),
                        color = Color.White,
                        modifier = Modifier.padding(Spacing.lg),
                    )
                }
            }
        }
        if (!block.caption.isNullOrBlank()) {
            Text(
                text = block.caption,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun KnowledgeCheckBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    val prompt = block.payload.text("prompt")
        ?: block.payload.text("question")
        ?: block.payload.text("text")
    val options = block.payload.textList("options")
    if (prompt.isNullOrBlank() && options.isEmpty()) return

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Quiz,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = stringResource(R.string.lesson_knowledge_check),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            if (!prompt.isNullOrBlank()) {
                Text(
                    text = prompt,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            options.forEach { option ->
                Text(
                    text = "• $option",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun CompletionBlock(block: LessonBlockDto, modifier: Modifier = Modifier) {
    Text(
        text = block.payload.text("message") ?: stringResource(R.string.lesson_completion_block),
        modifier = modifier.fillMaxWidth(),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun MediaUnavailable(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.surfaceVariant,
                RoundedCornerShape(12.dp),
            )
            .padding(Spacing.lg),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp),
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** `mm:ss`, or `h:mm:ss` for long recordings. Used by the audio controls. */
internal fun formatTime(milliseconds: Int): String {
    val totalSeconds = (milliseconds / 1000).coerceAtLeast(0)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%d:%02d".format(minutes, seconds)
    }
}

@Composable
private fun rememberAudioController(url: String?): AudioController {
    val controller = remember(url) { AudioController(url) }
    DisposableEffect(controller) {
        onDispose { controller.release() }
    }
    LaunchedEffect(controller.isPlaying) {
        while (controller.isPlaying) {
            controller.refreshPosition()
            delay(250)
        }
    }
    return controller
}

/**
 * Minimal wrapper around framework [MediaPlayer]. Media3 would be heavier than
 * the MVP needs; the requirements are play, pause, stop, seek, progress and a
 * clear failure state.
 */
@Stable
private class AudioController(private val url: String?) {

    var isPrepared by mutableStateOf(false)
        private set

    var isPlaying by mutableStateOf(false)
        private set

    var durationMs by mutableIntStateOf(0)
        private set

    var positionMs by mutableIntStateOf(0)
        private set

    var error by mutableStateOf(url.isNullOrBlank())
        private set

    private var player: MediaPlayer? = null

    init {
        if (!url.isNullOrBlank()) {
            prepare()
        }
    }

    fun retry() {
        releasePlayer()
        error = false
        isPrepared = false
        isPlaying = false
        durationMs = 0
        positionMs = 0
        if (!url.isNullOrBlank()) prepare()
    }

    fun toggle() {
        val current = player ?: return
        if (!isPrepared) return
        try {
            if (current.isPlaying) {
                current.pause()
                isPlaying = false
            } else {
                current.start()
                isPlaying = true
            }
        } catch (_: IllegalStateException) {
            error = true
            isPlaying = false
        }
    }

    fun stop() {
        val current = player ?: return
        try {
            current.pause()
            current.seekTo(0)
            positionMs = 0
            isPlaying = false
        } catch (_: IllegalStateException) {
            error = true
            isPlaying = false
        }
    }

    fun seekTo(milliseconds: Int) {
        val current = player ?: return
        try {
            current.seekTo(milliseconds)
            positionMs = milliseconds
        } catch (_: IllegalStateException) {
            error = true
        }
    }

    fun refreshPosition() {
        try {
            positionMs = player?.currentPosition ?: positionMs
        } catch (_: IllegalStateException) {
            error = true
            isPlaying = false
        }
    }

    fun release() {
        releasePlayer()
        isPlaying = false
    }

    private fun prepare() {
        val source = url ?: return
        val player = MediaPlayer()
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        player.setOnPreparedListener { prepared ->
            isPrepared = true
            durationMs = prepared.duration.coerceAtLeast(0)
            prepared.start()
            isPlaying = true
        }
        player.setOnCompletionListener { completed ->
            isPlaying = false
            positionMs = completed.duration.coerceAtLeast(0)
        }
        player.setOnErrorListener { _, _, _ ->
            error = true
            isPlaying = false
            true
        }
        try {
            player.setDataSource(source)
            player.prepareAsync()
            this.player = player
        } catch (_: Exception) {
            error = true
            player.release()
            this.player = null
        }
    }

    private fun releasePlayer() {
        player?.release()
        player = null
        isPrepared = false
    }
}
