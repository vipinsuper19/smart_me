package com.smartme.app.core.network

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class ApiErrorMapperTest {

    private val mapper = ApiErrorMapper(
        Json {
            ignoreUnknownKeys = true
            explicitNulls = false
        },
    )

    @Test
    fun `reads the backend error envelope`() {
        val body = """
            {
              "error": {
                "code": "INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
                "details": [{ "field": "email", "code": "invalid" }],
                "requestId": "req-123"
              }
            }
        """.trimIndent()

        val error = mapper.fromHttpStatus(401, body)

        assertEquals("INVALID_CREDENTIALS", error.code)
        assertEquals("Email or password is incorrect.", error.message)
        assertEquals(401, error.httpStatus)
        assertEquals("req-123", error.requestId)
        assertEquals(1, error.details.size)
        assertEquals("email", error.details.first().field)
    }

    @Test
    fun `ignores unknown envelope fields`() {
        val body = """{"error":{"code":"X","message":"Y","hint":"ignored"}}"""

        val error = mapper.fromHttpStatus(400, body)

        assertEquals("X", error.code)
        assertEquals("Y", error.message)
    }

    @Test
    fun `falls back to status copy when the body is not json`() {
        val error = mapper.fromHttpStatus(502, "<html>Bad gateway</html>")

        assertEquals("INTERNAL_ERROR", error.code)
        assertEquals(502, error.httpStatus)
        assertTrue(error.message.isNotBlank())
        assertNull(error.requestId)
    }

    @Test
    fun `falls back when the envelope is missing`() {
        assertEquals("NOT_FOUND", mapper.fromHttpStatus(404, """{"ok":false}""").code)
        assertEquals("RATE_LIMITED", mapper.fromHttpStatus(429, null).code)
        assertEquals("VALIDATION_ERROR", mapper.fromHttpStatus(422, "").code)
    }

    @Test
    fun `falls back when envelope text is blank`() {
        val error = mapper.fromHttpStatus(403, """{"error":{"code":"","message":"  "}}""")

        assertEquals("FORBIDDEN", error.code)
        assertEquals("You don't have access to this.", error.message)
    }

    @Test
    fun `maps a transport failure to a network error`() {
        val error = mapper.fromTransportFailure(UnknownHostException("api.smartme.app"))

        assertEquals(ApiErrorCodes.NETWORK_UNAVAILABLE, error.code)
        assertNull(error.httpStatus)
    }

    @Test
    fun `maps a timeout to a timeout error`() {
        val error = mapper.fromTransportFailure(SocketTimeoutException("read timed out"))

        assertEquals(ApiErrorCodes.TIMEOUT, error.code)
    }

    @Test
    fun `maps other io failures to network errors`() {
        assertEquals(
            ApiErrorCodes.NETWORK_UNAVAILABLE,
            mapper.fromTransportFailure(IOException("connection reset")).code,
        )
    }

    @Test
    fun `maps malformed payloads separately from unexpected failures`() {
        assertEquals(
            ApiErrorCodes.INVALID_RESPONSE,
            mapper.fromUnexpectedFailure(SerializationException("unexpected key")).code,
        )
        assertEquals(
            ApiErrorCodes.UNEXPECTED,
            mapper.fromUnexpectedFailure(IllegalStateException("boom")).code,
        )
    }
}
