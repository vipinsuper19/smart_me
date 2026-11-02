package com.smartme.app.core.security

/** Stores one opaque, already-encrypted session blob. */
interface TokenPersistence {
    suspend fun read(): String?
    suspend fun write(value: String)
    suspend fun clear()
}
