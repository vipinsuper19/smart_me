package com.smartme.app.core.security

/** Encrypts the session blob before it is persisted. */
interface TokenCipher {
    fun encrypt(plaintext: ByteArray): String
    fun decrypt(ciphertext: String): ByteArray
}
