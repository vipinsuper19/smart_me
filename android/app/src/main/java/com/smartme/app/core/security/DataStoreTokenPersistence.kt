package com.smartme.app.core.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first

/**
 * Persists the encrypted session in its own DataStore file so it can be excluded
 * from cloud backup and device transfer independently of general preferences.
 */
class DataStoreTokenPersistence(
    private val dataStore: DataStore<Preferences>,
) : TokenPersistence {

    override suspend fun read(): String? = dataStore.data.first()[TOKEN_KEY]

    override suspend fun write(value: String) {
        dataStore.edit { preferences -> preferences[TOKEN_KEY] = value }
    }

    override suspend fun clear() {
        dataStore.edit { preferences -> preferences.remove(TOKEN_KEY) }
    }

    private companion object {
        val TOKEN_KEY = stringPreferencesKey("encrypted_session")
    }
}
