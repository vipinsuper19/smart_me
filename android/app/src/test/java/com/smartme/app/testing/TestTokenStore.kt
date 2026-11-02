package com.smartme.app.testing

import com.smartme.app.core.security.TokenCipher
import com.smartme.app.core.security.TokenPersistence
import com.smartme.app.core.security.TokenStore
import kotlinx.serialization.json.Json
import java.util.Base64

/** In-memory replacement for the DataStore-backed session blob. */
class FakeTokenPersistence : TokenPersistence {
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
class FakeTokenCipher : TokenCipher {
    override fun encrypt(plaintext: ByteArray): String =
        Base64.getEncoder().encodeToString(
            plaintext.map { (it.toInt() xor 0x5A).toByte() }.toByteArray(),
        )

    override fun decrypt(ciphertext: String): ByteArray {
        val bytes = Base64.getDecoder().decode(ciphertext)
        return ByteArray(bytes.size) { index -> (bytes[index].toInt() xor 0x5A).toByte() }
    }
}

/** Mirrors the production JSON configuration. */
val testJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

fun testTokenStore(now: () -> Long = System::currentTimeMillis): TokenStore =
    TokenStore(FakeTokenPersistence(), FakeTokenCipher(), testJson, now)
