package com.smartme.app.core.network

/**
 * A failure the UI can render. Mirrors the backend error envelope
 * (`{ "error": { code, message, details, requestId } }`) and adds the
 * client-only codes used when the request never reached the API.
 */
data class ApiError(
    val code: String,
    val message: String,
    val httpStatus: Int? = null,
    val details: List<ApiErrorDetail> = emptyList(),
    val requestId: String? = null,
)

data class ApiErrorDetail(
    val field: String? = null,
    val code: String? = null,
)

object ApiErrorCodes {
    const val NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE"
    const val TIMEOUT = "TIMEOUT"
    const val INVALID_RESPONSE = "INVALID_RESPONSE"
    const val UNEXPECTED = "UNEXPECTED"
}
