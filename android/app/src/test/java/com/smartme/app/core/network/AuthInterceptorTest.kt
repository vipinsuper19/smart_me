package com.smartme.app.core.network

import com.smartme.app.core.security.SessionTokens
import com.smartme.app.core.security.TokenStore
import com.smartme.app.testing.testTokenStore
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AuthInterceptorTest {

    private lateinit var server: MockWebServer
    private lateinit var tokenStore: TokenStore

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        tokenStore = testTokenStore()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `attaches the access token and never refreshes a successful request`() = runBlocking {
        saveSession(accessToken = "access-1", accessExpiresInMillis = ONE_HOUR)
        val refresher = FakeSessionRefresher("fresh")
        server.enqueue(ok())

        client(refresher).execute().use { response ->
            assertEquals(200, response.code)
        }

        assertEquals("Bearer access-1", server.takeRequest().getHeader(HEADER))
        assertEquals(0, refresher.calls)
    }

    @Test
    fun `refreshes once and replays the request after a 401`() = runBlocking {
        saveSession(accessToken = "stale", accessExpiresInMillis = ONE_HOUR)
        val refresher = FakeSessionRefresher("fresh")
        server.enqueue(MockResponse().setResponseCode(401).setBody(ERROR_BODY))
        server.enqueue(ok())

        client(refresher).execute().use { response ->
            assertEquals(200, response.code)
            assertEquals("recovered", response.body.string())
        }

        assertEquals("Bearer stale", server.takeRequest().getHeader(HEADER))
        assertEquals("Bearer fresh", server.takeRequest().getHeader(HEADER))
        assertEquals(1, refresher.calls)
        assertEquals(listOf("stale"), refresher.failedTokens)
    }

    @Test
    fun `returns the original 401 when the refresh cannot recover the session`() = runBlocking {
        saveSession(accessToken = "stale", accessExpiresInMillis = ONE_HOUR)
        val refresher = FakeSessionRefresher(null)
        server.enqueue(MockResponse().setResponseCode(401).setBody(ERROR_BODY))

        client(refresher).execute().use { response ->
            assertEquals(401, response.code)
        }

        assertEquals(1, server.requestCount)
        assertEquals(1, refresher.calls)
    }

    @Test
    fun `refreshes before sending when the stored access token has already expired`() = runBlocking {
        saveSession(accessToken = "expired", accessExpiresInMillis = -ONE_HOUR)
        val refresher = FakeSessionRefresher("fresh")
        server.enqueue(ok())

        client(refresher).execute().use { response ->
            assertEquals(200, response.code)
        }

        assertEquals("Bearer fresh", server.takeRequest().getHeader(HEADER))
        assertEquals(1, refresher.calls)
        assertEquals(listOf(""), refresher.failedTokens)
    }

    @Test
    fun `refreshes again when the proactively refreshed token is rejected`() = runBlocking {
        saveSession(accessToken = "expired", accessExpiresInMillis = -ONE_HOUR)
        val refresher = FakeSessionRefresher(listOf("fresh-1", "fresh-2"))
        server.enqueue(MockResponse().setResponseCode(401).setBody(ERROR_BODY))
        server.enqueue(ok())

        client(refresher).execute().use { response ->
            assertEquals(200, response.code)
        }

        assertEquals("Bearer fresh-1", server.takeRequest().getHeader(HEADER))
        assertEquals("Bearer fresh-2", server.takeRequest().getHeader(HEADER))
        assertEquals(2, refresher.calls)
        assertEquals(listOf("", "fresh-1"), refresher.failedTokens)
    }

    @Test
    fun `sends no credentials when there is no session`() {
        val refresher = FakeSessionRefresher("fresh")
        server.enqueue(ok())

        client(refresher).execute().use { response ->
            assertEquals(200, response.code)
        }

        assertNull(server.takeRequest().getHeader(HEADER))
        assertEquals(0, refresher.calls)
    }

    private fun client(refresher: SessionRefresher): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore, refresher))
            .build()

    private fun OkHttpClient.execute(): Response =
        newCall(Request.Builder().url(server.url("/test")).build()).execute()

    private suspend fun saveSession(accessToken: String, accessExpiresInMillis: Long) {
        val now = System.currentTimeMillis()
        tokenStore.save(
            SessionTokens(
                accessToken = accessToken,
                refreshToken = "refresh-1",
                accessTokenExpiresAt = now + accessExpiresInMillis,
                refreshTokenExpiresAt = now + THIRTY_DAYS,
            ),
        )
    }

    private fun ok(): MockResponse =
        MockResponse().setResponseCode(200).setBody("recovered")

    private class FakeSessionRefresher(private val tokens: List<String?>) : SessionRefresher {
        constructor(token: String?) : this(listOf(token))

        var calls = 0
        val failedTokens = mutableListOf<String>()

        override fun refreshBlocking(failedAccessToken: String): String? {
            failedTokens += failedAccessToken
            val token = tokens.getOrElse(calls) { tokens.lastOrNull() }
            calls += 1
            return token
        }
    }

    private companion object {
        const val HEADER = "Authorization"
        const val ONE_HOUR = 60L * 60 * 1000
        const val THIRTY_DAYS = 30L * 24 * 60 * 60 * 1000
        const val ERROR_BODY = """{"error":{"code":"INVALID_ACCESS_TOKEN","message":"expired"}}"""
    }
}
