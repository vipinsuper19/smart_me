package com.smartme.app.core.security

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * The single owner of the learner session.
 *
 * Tokens are encrypted with a hardware-backed Keystore key before they reach
 * disk, the decrypted copy lives only in memory, and an access token is handed
 * to the network layer only while it is still valid.
 */
class TokenStore(
    private val persistence: TokenPersistence,
    private val cipher: TokenCipher,
    private val json: Json,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val _session = MutableStateFlow<SessionTokens?>(null)
    val session: StateFlow<SessionTokens?> = _session.asStateFlow()

    private val _isRestored = MutableStateFlow(false)

    /** True once [restore] has finished, whether or not a session was found. */
    val isRestored: StateFlow<Boolean> = _isRestored.asStateFlow()

    @Volatile
    private var cachedAccessToken: String? = null

    /** Non-suspending read for OkHttp interceptors. */
    fun accessTokenOrNull(): String? = cachedAccessToken

    fun isSignedIn(): Boolean = _session.value != null

    /** Loads the persisted session, if any, into memory. Safe to call repeatedly. */
    suspend fun restore(): SessionTokens? = withContext(Dispatchers.IO) {
        try {
            val encoded = runCatching { persistence.read() }.getOrNull()
            val tokens = encoded?.let(::decode)
            publish(tokens)
            tokens
        } finally {
            _isRestored.value = true
        }
    }

    suspend fun save(tokens: SessionTokens) = withContext(Dispatchers.IO) {
        val payload = json.encodeToString(TokenPayload.serializer(), TokenPayload.from(tokens))
        persistence.write(cipher.encrypt(payload.encodeToByteArray()))
        publish(tokens)
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        runCatching { persistence.clear() }
        publish(null)
    }

    private fun decode(encoded: String): SessionTokens? = runCatching {
        val plaintext = cipher.decrypt(encoded)
        json.decodeFromString(TokenPayload.serializer(), plaintext.decodeToString()).toSessionTokens()
    }.getOrNull()

    private fun publish(tokens: SessionTokens?) {
        _session.value = tokens
        cachedAccessToken = tokens
            ?.takeIf { it.isAccessTokenValid(now()) }
            ?.accessToken
    }
}
