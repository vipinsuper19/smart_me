package com.smartme.app.data.auth

import com.smartme.app.core.network.AuthApi
import com.smartme.app.core.security.SessionTokens
import com.smartme.app.core.security.TokenStore
import com.smartme.app.testing.testJson
import com.smartme.app.testing.testTokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

class DefaultSessionRefresherTest {

    private lateinit var server: MockWebServer
    private lateinit var authApi: AuthApi
    private lateinit var tokenStore: TokenStore

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        authApi = apiFor(server)
        tokenStore = testTokenStore()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `a successful refresh replaces the stored session`() = runBlocking {
        saveExpiredAccessSession()
        server.enqueue(refreshOk())
        val refresher = DefaultSessionRefresher(authApi, tokenStore)

        val token = refresher.refreshBlocking("old-access")

        assertEquals("new-access", token)
        val session = requireNotNull(tokenStore.session.value)
        assertEquals("new-access", session.accessToken)
        assertEquals("new-refresh", session.refreshToken)
        assertEquals(1, server.requestCount)

        val request = server.takeRequest()
        assertEquals("/auth/refresh", request.path)
        assertEquals(
            """{"refreshToken":"old-refresh"}""",
            request.body.readUtf8(),
        )
    }

    @Test
    fun `reuses an access token that another request already refreshed`() = runBlocking {
        saveSession(accessToken = "new-access", accessExpiresInMillis = ONE_HOUR)
        val refresher = DefaultSessionRefresher(authApi, tokenStore)

        val token = refresher.refreshBlocking("old-access")

        assertEquals("new-access", token)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `a rejected refresh clears the session`() = runBlocking {
        saveExpiredAccessSession()
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"error":{"code":"INVALID_REFRESH_TOKEN","message":"revoked"}}"""),
        )
        val refresher = DefaultSessionRefresher(authApi, tokenStore)

        assertNull(refresher.refreshBlocking("old-access"))
        assertNull(tokenStore.session.value)
    }

    @Test
    fun `an expired refresh token clears the session without a request`() = runBlocking {
        val now = System.currentTimeMillis()
        tokenStore.save(
            SessionTokens(
                accessToken = "old-access",
                refreshToken = "old-refresh",
                accessTokenExpiresAt = now - ONE_HOUR,
                refreshTokenExpiresAt = now - 1,
            ),
        )
        val refresher = DefaultSessionRefresher(authApi, tokenStore)

        assertNull(refresher.refreshBlocking("old-access"))
        assertNull(tokenStore.session.value)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `a transport failure keeps the session for a later retry`() {
        runBlocking { saveExpiredAccessSession() }
        val deadServer = MockWebServer()
        deadServer.start()
        val deadApi = apiFor(deadServer)
        deadServer.shutdown()
        val refresher = DefaultSessionRefresher(deadApi, tokenStore)

        assertNull(refresher.refreshBlocking("old-access"))
        assertNotNull(tokenStore.session.value)
    }

    @Test
    fun `concurrent callers share a single refresh request`() = runBlocking {
        saveExpiredAccessSession()
        server.enqueue(refreshOk())
        val refresher = DefaultSessionRefresher(authApi, tokenStore)

        val results = coroutineScope {
            (1..8)
                .map { async(Dispatchers.IO) { refresher.refreshBlocking("old-access") } }
                .awaitAll()
        }

        assertEquals(List(8) { "new-access" }, results)
        assertEquals(1, server.requestCount)
    }

    private fun apiFor(server: MockWebServer): AuthApi = Retrofit.Builder()
        .baseUrl(server.url("/"))
        .addConverterFactory(testJson.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(AuthApi::class.java)

    private suspend fun saveExpiredAccessSession() {
        saveSession(accessToken = "old-access", accessExpiresInMillis = -ONE_HOUR)
    }

    private suspend fun saveSession(accessToken: String, accessExpiresInMillis: Long) {
        val now = System.currentTimeMillis()
        tokenStore.save(
            SessionTokens(
                accessToken = accessToken,
                refreshToken = "old-refresh",
                accessTokenExpiresAt = now + accessExpiresInMillis,
                refreshTokenExpiresAt = now + THIRTY_DAYS,
            ),
        )
    }

    private fun refreshOk(): MockResponse = MockResponse()
        .setResponseCode(200)
        .setBody(
            """
            {
              "user": {
                "id": "user-1",
                "email": "learner@example.com",
                "onboardingCompletedAt": "2099-01-01T00:00:00.000Z"
              },
              "tokens": {
                "accessToken": "new-access",
                "refreshToken": "new-refresh",
                "accessTokenExpiresAt": "2099-01-01T00:00:00.000Z",
                "refreshTokenExpiresAt": "2099-02-01T00:00:00.000Z"
              }
            }
            """.trimIndent(),
        )

    private companion object {
        const val ONE_HOUR = 60L * 60 * 1000
        const val THIRTY_DAYS = 30L * 24 * 60 * 60 * 1000
    }
}
