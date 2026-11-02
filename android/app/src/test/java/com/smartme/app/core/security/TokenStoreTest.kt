package com.smartme.app.core.security

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.Base64

class TokenStoreTest {

    private val json = Json { ignoreUnknownKeys = true }
    private val clock = FakeClock(current = 1_700_000_000_000L)
    private val persistence = FakePersistence()
    private val cipher = FakeCipher()

    private lateinit var store: TokenStore

    @Before
    fun setUp() {
        store = TokenStore(persistence, cipher, json, clock::now)
    }

    @Test
    fun `save stores ciphertext and publishes the session`() = runTest {
        val tokens = tokens(expiresInMillis = 60 * 60 * 1000)

        store.save(tokens)

        assertTrue(store.isSignedIn())
        assertEquals(tokens, store.session.value)
        assertEquals(tokens.accessToken, store.accessTokenOrNull())

        val stored = requireNotNull(persistence.value)
        assertFalse("plaintext token must never reach storage", "access-token" in stored)
        assertFalse("plaintext token must never reach storage", "refresh-token" in stored)
    }

    @Test
    fun `restore loads a saved session in a fresh store`() = runTest {
        val tokens = tokens(expiresInMillis = 60 * 60 * 1000)
        store.save(tokens)

        val reopened = TokenStore(persistence, cipher, json, clock::now)
        val restored = reopened.restore()

        assertEquals(tokens, restored)
        assertEquals(tokens.accessToken, reopened.accessTokenOrNull())
        assertTrue(reopened.isSignedIn())
    }

    @Test
    fun `restore without stored data signs the user out`() = runTest {
        assertNull(store.restore())
        assertFalse(store.isSignedIn())
        assertNull(store.accessTokenOrNull())
    }

    @Test
    fun `expired access token is hidden from the network layer`() = runTest {
        val tokens = tokens(expiresInMillis = 5_000)

        store.save(tokens)

        assertTrue("session stays available for a refresh", store.isSignedIn())
        assertNull(store.accessTokenOrNull())
    }

    @Test
    fun `access token inside the expiry skew is treated as expired`() = runTest {
        val tokens = tokens(expiresInMillis = SessionTokens.DEFAULT_SKEW_MILLIS - 1_000)

        store.save(tokens)

        assertNull(store.accessTokenOrNull())
    }

    @Test
    fun `clear removes stored data and signs the user out`() = runTest {
        store.save(tokens(expiresInMillis = 60 * 60 * 1000))

        store.clear()

        assertNull(persistence.value)
        assertFalse(store.isSignedIn())
        assertNull(store.session.value)
        assertNull(store.accessTokenOrNull())
    }

    @Test
    fun `corrupt ciphertext is treated as signed out instead of crashing`() = runTest {
        persistence.value = "!!!not-valid-ciphertext!!!"

        assertNull(store.restore())
        assertFalse(store.isSignedIn())
        assertNull(store.accessTokenOrNull())
    }

    private fun tokens(expiresInMillis: Long) = SessionTokens(
        accessToken = "access-token",
        refreshToken = "refresh-token",
        accessTokenExpiresAt = clock.now() + expiresInMillis,
        refreshTokenExpiresAt = clock.now() + 30L * 24 * 60 * 60 * 1000,
    )

    private class FakeClock(private var current: Long) {
        fun now(): Long = current
    }

    private class FakePersistence : TokenPersistence {
        var value: String? = null

        override suspend fun read(): String? = value

        override suspend fun write(value: String) {
            this.value = value
        }

        override suspend fun clear() {
            value = null
        }
    }

    /** Reversible, obviously-not-plaintext stand-in for the Keystore cipher. */
    private class FakeCipher : TokenCipher {
        override fun encrypt(plaintext: ByteArray): String =
            Base64.getEncoder().encodeToString(plaintext.map { (it.toInt() xor 0x5A).toByte() }.toByteArray())

        override fun decrypt(ciphertext: String): ByteArray {
            val bytes = Base64.getDecoder().decode(ciphertext)
            return ByteArray(bytes.size) { index -> (bytes[index].toInt() xor 0x5A).toByte() }
        }
    }
}
