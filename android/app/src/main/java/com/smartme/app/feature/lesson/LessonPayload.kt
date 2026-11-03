package com.smartme.app.feature.lesson

import com.smartme.app.core.network.LessonBlockDto
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// Lesson block payloads are untyped JSON (docs/CONTENT-MODEL.md §3). These
// helpers read defensively so a malformed block renders an empty section
// instead of crashing the player.

internal fun JsonObject.text(key: String): String? =
    this[key]?.jsonPrimitive?.contentOrNull

internal fun JsonObject.textList(key: String): List<String> {
    val array = this[key] as? JsonArray ?: return emptyList()
    return array.mapNotNull { it.jsonPrimitive.contentOrNull }
}

internal data class ConversationLine(val speaker: String, val text: String)

internal fun JsonObject.conversationLines(): List<ConversationLine> {
    val array = this["lines"] as? JsonArray ?: return emptyList()
    return array.mapNotNull { element ->
        val line = element as? JsonObject ?: return@mapNotNull null
        val text = line.text("text") ?: return@mapNotNull null
        ConversationLine(
            speaker = line.text("speaker").orEmpty(),
            text = text,
        )
    }
}

/**
 * Reading progress derived from the first visible block. Reaching the last
 * block reports 99%, leaving 100% for the explicit "Complete lesson" action so
 * the bar never claims completion before the backend records it.
 */
internal fun scrollProgressPercent(firstVisibleIndex: Int, totalBlocks: Int): Int {
    if (totalBlocks <= 0) return 0
    val viewed = (firstVisibleIndex + 1).coerceIn(1, totalBlocks)
    return ((viewed * 100) / totalBlocks).coerceIn(1, 99)
}

/** Maps a saved `lastBlockOrder` back to a list index, tolerating server drift. */
internal fun resumeBlockIndex(blocks: List<LessonBlockDto>, lastBlockOrder: Int?): Int {
    val order = lastBlockOrder ?: return 0
    val index = blocks.indexOfFirst { it.order >= order }
    return if (index >= 0) index else 0
}
