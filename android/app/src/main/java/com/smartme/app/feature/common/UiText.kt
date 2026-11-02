package com.smartme.app.feature.common

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource

/**
 * A user-facing message that is either a localised resource or text already
 * produced by the API/error mapper.
 *
 * Validation errors stay as resource ids so they follow the device language;
 * server messages are shown as-is because the backend already writes learner
 * friendly copy.
 */
sealed interface UiText {
    data class Resource(@param:StringRes val resource: Int) : UiText
    data class Plain(val text: String) : UiText
}

@Composable
fun UiText.asString(): String = when (this) {
    is UiText.Resource -> stringResource(resource)
    is UiText.Plain -> text
}
