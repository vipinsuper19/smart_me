package com.smartme.app.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import com.smartme.app.di.DataStoreNames
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Small cache of server-side session facts that must survive a cold start
 * without a network call, most importantly whether onboarding is finished.
 *
 * Stored in the general preferences DataStore rather than next to the encrypted
 * tokens: it is not secret, and it must survive token rotation.
 */
@Singleton
class SessionPreferences @Inject constructor(
    @Named(DataStoreNames.PREFERENCES) private val dataStore: DataStore<Preferences>,
) {

    /** `null` when this install has no recorded value and the API must be asked. */
    suspend fun onboardingCompleted(): Boolean? = dataStore.data.first()[ONBOARDING_COMPLETED]

    suspend fun setOnboardingCompleted(value: Boolean?) {
        dataStore.edit { preferences ->
            if (value == null) {
                preferences.remove(ONBOARDING_COMPLETED)
            } else {
                preferences[ONBOARDING_COMPLETED] = value
            }
        }
    }

    private companion object {
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
    }
}
