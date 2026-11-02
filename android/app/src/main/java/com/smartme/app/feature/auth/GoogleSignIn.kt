package com.smartme.app.feature.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.smartme.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

sealed interface GoogleIdTokenResult {
    data class Success(val idToken: String) : GoogleIdTokenResult

    /** The learner dismissed the Google account picker; show nothing. */
    data object Cancelled : GoogleIdTokenResult

    /** Configuration, Play Services or token parsing failed. */
    data object Failed : GoogleIdTokenResult
}

/**
 * Wraps Credential Manager so the view models do not touch Play Services APIs.
 *
 * Google Sign-In is optional: when [isConfigured] is false the UI hides the
 * button entirely, which keeps local builds and builds without a client ID
 * clean.
 */
@Singleton
class GoogleSignInClient @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val clientId: String = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()

    val isConfigured: Boolean
        get() = clientId.isNotBlank()

    suspend fun idToken(activityContext: Context): GoogleIdTokenResult {
        if (!isConfigured) return GoogleIdTokenResult.Failed

        val option = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(clientId)
            .setAutoSelectEnabled(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()

        return try {
            val credential = CredentialManager.create(context)
                .getCredential(activityContext, request)
                .credential
            if (credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
                if (idToken.isBlank()) GoogleIdTokenResult.Failed else GoogleIdTokenResult.Success(idToken)
            } else {
                GoogleIdTokenResult.Failed
            }
        } catch (cancellation: GetCredentialCancellationException) {
            GoogleIdTokenResult.Cancelled
        } catch (noCredential: NoCredentialException) {
            // No Google account is signed in on this device. There is nothing to
            // pick, so surface the same retry copy as any other failure.
            GoogleIdTokenResult.Failed
        } catch (parsing: GoogleIdTokenParsingException) {
            GoogleIdTokenResult.Failed
        } catch (credential: GetCredentialException) {
            GoogleIdTokenResult.Failed
        }
    }
}
