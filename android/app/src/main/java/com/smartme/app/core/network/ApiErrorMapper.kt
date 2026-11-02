package com.smartme.app.core.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.SocketTimeoutException

@Serializable
internal data class ApiErrorEnvelope(val error: ApiErrorBody? = null)

@Serializable
internal data class ApiErrorBody(
    val code: String? = null,
    val message: String? = null,
    val details: List<ApiErrorDetailBody> = emptyList(),
    val requestId: String? = null,
)

@Serializable
internal data class ApiErrorDetailBody(
    val field: String? = null,
    val code: String? = null,
)

/**
 * Turns an HTTP status plus response body into an [ApiError].
 *
 * The backend always sends `{ error: { code, message } }` (ADR 0004). If a proxy
 * or an unexpected failure returns something else, the status alone decides the
 * fallback so the UI still has safe, non-technical copy to show.
 */
class ApiErrorMapper(private val json: Json) {

    fun fromHttpStatus(status: Int, body: String?): ApiError {
        val parsed = body
            ?.takeIf { it.isNotBlank() }
            ?.let { runCatching { json.decodeFromString(ApiErrorEnvelope.serializer(), it) }.getOrNull() }
            ?.error
        val fallback = fallbackFor(status)

        return ApiError(
            code = parsed?.code?.takeIf { it.isNotBlank() } ?: fallback.code,
            message = parsed?.message?.takeIf { it.isNotBlank() } ?: fallback.message,
            httpStatus = status,
            details = parsed?.details.orEmpty().map { ApiErrorDetail(field = it.field, code = it.code) },
            requestId = parsed?.requestId,
        )
    }

    fun fromTransportFailure(cause: Throwable): ApiError = if (cause is SocketTimeoutException) {
        ApiError(
            code = ApiErrorCodes.TIMEOUT,
            message = "SmartMe took too long to respond. Please try again.",
        )
    } else {
        ApiError(
            code = ApiErrorCodes.NETWORK_UNAVAILABLE,
            message = "We couldn't reach SmartMe. Check your connection and try again.",
        )
    }

    fun fromUnexpectedFailure(cause: Throwable): ApiError = if (cause is kotlinx.serialization.SerializationException) {
        ApiError(
            code = ApiErrorCodes.INVALID_RESPONSE,
            message = "SmartMe sent an unexpected response. Please try again.",
        )
    } else {
        ApiError(
            code = ApiErrorCodes.UNEXPECTED,
            message = "Something went wrong. Please try again.",
        )
    }

    private fun fallbackFor(status: Int): Fallback = when (status) {
        400, 422 -> Fallback("VALIDATION_ERROR", "Please check the information you entered.")
        401 -> Fallback("UNAUTHENTICATED", "Your session has expired. Please sign in again.")
        403 -> Fallback("FORBIDDEN", "You don't have access to this.")
        404 -> Fallback("NOT_FOUND", "We couldn't find what you were looking for.")
        409 -> Fallback("CONFLICT", "That isn't available right now.")
        429 -> Fallback("RATE_LIMITED", "Too many requests. Please wait a moment and try again.")
        in 500..599 -> Fallback("INTERNAL_ERROR", "Something went wrong on our side. Please try again.")
        else -> Fallback(ApiErrorCodes.UNEXPECTED, "Something went wrong. Please try again.")
    }

    private data class Fallback(val code: String, val message: String)
}
